#ifndef OV_SERVER_H
#define OV_SERVER_H

#include "callerlist.h"
#include "common.h"
#include "errmsg.h"
#include "udpsocket.h"
#include <condition_variable>
#include <functional>
#include <queue>
#include <signal.h>
#include <string.h>
#include <thread>
#include <vector>

// period time of participant list announcement, in ping periods:
#define PARTICIPANTANNOUNCEPERIOD 20

class latreport_t {
public:
  latreport_t() : src(0), dest(0), tmean(0), jitter(0){};
  latreport_t(stage_device_id_t src_, stage_device_id_t dest_, double tmean_,
              double jitter_)
      : src(src_), dest(dest_), tmean(tmean_), jitter(jitter_){};
  stage_device_id_t src;
  stage_device_id_t dest;
  double tmean;
  double jitter;
};

class ov_server_t : public endpoint_list_t {
public:
  ov_server_t(int portno, int prio, const std::string& group_);
  ~ov_server_t();
  int portno;
  void srv();
  void announce_new_connection(stage_device_id_t cid, const ep_desc_t& ep);
  void announce_connection_lost(stage_device_id_t cid);
  void announce_latency(stage_device_id_t cid, double lmin, double lmean,
                        double lmax, uint32_t received, uint32_t lost);
  void set_lobbyurl(const std::string& url) { lobbyurl = url; };
  void set_roomname(const std::string& name) { roomname = name; };

private:
  void jittermeasurement_service();
  std::thread jittermeasurement_thread;
  void announce_service();
  std::thread announce_thread;
  void ping_and_callerlist_service();
  std::thread logthread;
  void quitwatch();
  std::thread quitthread;
  const int prio;

  secret_t secret;
  ovbox_udpsocket_t socket;
  bool runsession;
  std::string roomname;
  std::string lobbyurl;

  std::queue<latreport_t> latfifo;
  std::mutex latfifomtx;

  double serverjitter;

  std::string group;
};

#endif // OV_SERVER_H
