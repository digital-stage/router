#include "ov-server.h"

static bool quit_app(false);

ov_server_t::ov_server_t(int portno_, int prio, const std::string& stage_id)
    : portno(portno_), prio(prio), secret(1234), socket(secret), runsession(true),
      stage_id(stage_id), serverjitter(-1)
{
  // Init chrono and seed
  std::chrono::high_resolution_clock::time_point start(std::chrono::high_resolution_clock::now());
  std::chrono::high_resolution_clock::time_point end(std::chrono::high_resolution_clock::now());
  unsigned int seed(
      std::chrono::duration_cast<std::chrono::nanoseconds>(end - start)
          .count());
  seed += portno;
  // initialize random generator:
  srandom(seed);

  socket.set_timeout_usec(100000);
  portno = socket.bind(portno);

  logthread = std::thread(&ov_server_t::ping_and_callerlist_service, this);
  quitthread = std::thread(&ov_server_t::quitwatch, this);

  // OV box related
  endpoints.resize(255);
  jittermeasurement_thread =
      std::thread(&ov_server_t::jittermeasurement_service, this);
  announce_thread = std::thread(&ov_server_t::announce_service, this);

  // Now start worker
  workerthread = std::thread(&ov_server_t::srv, this);
}

ov_server_t::~ov_server_t()
{
  runsession = false;
  logthread.join();
  quitthread.join();
  workerthread.join();
}

void ov_server_t::quitwatch()
{
  while(!quit_app)
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
  runsession = false;
  socket.close();
}

void ov_server_t::announce_new_connection(stage_device_id_t cid,
                                          const ep_desc_t& ep)
{
  log(portno,
      "new connection for " + std::to_string(cid) + " from " + ep2str(ep.ep) +
          " in " + ((ep.mode & B_PEER2PEER) ? "peer-to-peer" : "server") +
          "-mode" + ((ep.mode & B_DOWNMIXONLY) ? " downmixonly" : "") +
          ((ep.mode & B_DONOTSEND) ? " donotsend" : "") + " v" + ep.version);
}

void ov_server_t::announce_connection_lost(stage_device_id_t cid)
{
  log(portno, "connection for " + std::to_string(cid) + " lost.");
}

void ov_server_t::announce_latency(stage_device_id_t cid, double lmin,
                                   double lmean, double lmax, uint32_t received,
                                   uint32_t lost)
{
  if(lmean > 0) {
    {
      std::lock_guard<std::mutex> lk(latfifomtx);
      latfifo.push(latreport_t(cid, 200, lmean, lmax - lmean));
    }
    char ctmp[1024];
    sprintf(ctmp, "latency %d min=%1.2fms, mean=%1.2fms, max=%1.2fms", cid,
            lmin, lmean, lmax);
    log(portno, ctmp);
  }
}

// this thread announces the room service to the lobby:
void ov_server_t::announce_service()
{
  // participand announcement counter:
  uint32_t cnt(0);
  char cpost[1024];
  while(runsession) {
    if(!cnt) {
      std::cout << "announce_service: " << cnt << std::endl;
      // if nobody is connected create a new pin:
      if(get_num_clients() == 0) {
        long int r(random());
        secret = r & 0xfffffff;
        socket.set_secret(secret);
      }
      std::cout << "sending status" << std::endl;
      this->on_status({
        this->stage_id,
        secret,
        serverjitter,
        this->portno
      });
      cnt = 6000;
    }
    --cnt;
    std::this_thread::sleep_for(std::chrono::milliseconds(PINGPERIODMS));
    while(!latfifo.empty()) {
      latreport_t lr(latfifo.front());
      latfifo.pop();

      std::cout << "sending latency" << std::endl;
      this->on_latency({
          this->stage_id,
          lr.src,
          lr.dest,
          lr.tmean,
          lr.jitter
      });
    }
  }
}

// this thread sends ping and participant list messages
void ov_server_t::ping_and_callerlist_service()
{
  char buffer[BUFSIZE];
  // participand announcement counter:
  uint32_t participantannouncementcnt(PARTICIPANTANNOUNCEPERIOD);
  while(runsession) {
    std::this_thread::sleep_for(std::chrono::milliseconds(PINGPERIODMS));
    // send ping message to all connected endpoints:
    for(stage_device_id_t cid = 0; cid != MAXEP; ++cid) {
      if(endpoints[cid].timeout) {
        // endpoint is connected
        socket.send_ping(cid, endpoints[cid].ep);
      }
    }
    if(!participantannouncementcnt) {
      // announcement of connected participants to all clients:
      participantannouncementcnt = PARTICIPANTANNOUNCEPERIOD;
      for(stage_device_id_t cid = 0; cid != MAXEP; ++cid) {
        if(endpoints[cid].timeout) {
          for(stage_device_id_t epl = 0; epl != MAXEP; ++epl) {
            if(endpoints[epl].timeout) {
              // endpoint is alive, send info of epl to cid:
              size_t n = packmsg(buffer, BUFSIZE, secret, epl, PORT_LISTCID,
                                 endpoints[epl].mode,
                                 (const char*)(&(endpoints[epl].ep)),
                                 sizeof(endpoints[epl].ep));
              socket.send(buffer, n, endpoints[cid].ep);
              n = packmsg(buffer, BUFSIZE, secret, epl, PORT_SETLOCALIP, 0,
                          (const char*)(&(endpoints[epl].localep)),
                          sizeof(endpoints[epl].localep));
              socket.send(buffer, n, endpoints[cid].ep);
            }
          }
        }
      }
    }
    --participantannouncementcnt;
  }
}

void ov_server_t::srv()
{
  set_thread_prio(prio);
  char buffer[BUFSIZE];
  log(portno, "Multiplex service started (version " OVBOXVERSION ")");
  this->on_ready(portno);
  endpoint_t sender_endpoint;
  stage_device_id_t rcallerid;
  port_t destport;
  while(runsession) {
    size_t n(BUFSIZE);
    size_t un(BUFSIZE);
    sequence_t seq(0);
    char* msg(socket.recv_sec_msg(buffer, n, un, rcallerid, destport, seq,
                                  sender_endpoint));
    if(msg) {
      // retransmit data:
      if(destport > MAXSPECIALPORT) {
        for(stage_device_id_t ep = 0; ep != MAXEP; ++ep) {
          if((ep != rcallerid) && (endpoints[ep].timeout > 0) &&
             (!(endpoints[ep].mode & B_DONOTSEND)) &&
             ((!(endpoints[ep].mode & B_PEER2PEER)) ||
              (!(endpoints[rcallerid].mode & B_PEER2PEER))) &&
             ((!(endpoints[ep].mode & B_DOWNMIXONLY)) ||
              (rcallerid == MAXEP - 1))) {
            socket.send(buffer, n, endpoints[ep].ep);
          }
        }
      } else {
        // this is a control message:
        switch(destport) {
        case PORT_SEQREP:
          if(un == sizeof(sequence_t) + sizeof(stage_device_id_t)) {
            stage_device_id_t sender_cid(*(sequence_t*)msg);
            sequence_t seq(*(sequence_t*)(&(msg[sizeof(stage_device_id_t)])));
            char ctmp[1024];
            sprintf(ctmp, "sequence error %d sender %d %d", rcallerid,
                    sender_cid, seq);
            log(portno, ctmp);
          }
          break;
        case PORT_PEERLATREP:
          if(un == 6 * sizeof(double)) {
            double* data((double*)msg);
            {
              std::lock_guard<std::mutex> lk(latfifomtx);
              latfifo.push(
                  latreport_t(rcallerid, data[0], data[2], data[3] - data[2]));
            }
            char ctmp[1024];
            sprintf(ctmp,
                    "peerlat %d-%g min=%1.2fms, mean=%1.2fms, max=%1.2fms",
                    rcallerid, data[0], data[1], data[2], data[3]);
            log(portno, ctmp);
            sprintf(ctmp, "packages %d-%g received=%g lost=%g (%1.2f%%)",
                    rcallerid, data[0], data[4], data[5],
                    100.0 * data[5] / (std::max(1.0, data[4] + data[5])));
            log(portno, ctmp);
          }
          break;
        case PORT_PONG: {
          double tms(get_pingtime(msg, un));
          if(tms > 0)
            cid_setpingtime(rcallerid, tms);
        } break;
        case PORT_SETLOCALIP:
          if(un == sizeof(endpoint_t)) {
            endpoint_t* localep((endpoint_t*)msg);
            cid_setlocalip(rcallerid, *localep);
          }
          break;
        case PORT_REGISTER:
          // in the register packet the sequence is used to transmit
          // peer2peer flag:
          std::string rver("---");
          if(un > 0) {
            msg[un - 1] = 0;
            rver = msg;
          }
          cid_register(rcallerid, sender_endpoint, seq, rver);
          break;
        }
      }
    }
  }
  log(portno, "Multiplex service stopped");
}

double get_pingtime(std::chrono::high_resolution_clock::time_point& t1)
{
  std::chrono::high_resolution_clock::time_point t2(
      std::chrono::high_resolution_clock::now());
  std::chrono::duration<double> time_span =
      std::chrono::duration_cast<std::chrono::duration<double>>(t2 - t1);
  t1 = t2;
  return (1000.0 * time_span.count());
}

void ov_server_t::jittermeasurement_service()
{
  set_thread_prio(prio - 1);
  std::chrono::high_resolution_clock::time_point t1;
  get_pingtime(t1);
  while(runsession) {
    std::this_thread::sleep_for(std::chrono::microseconds(2000));
    double t(get_pingtime(t1));
    t -= 2.0;
    serverjitter = std::max(t, serverjitter);
  }
}

void ov_server_t::stop()
{
    quit_app = true;
}
