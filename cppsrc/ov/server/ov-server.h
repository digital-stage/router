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

struct connection_report_t {
  std::string stage_id;
  stage_device_id_t cid;
  const ep_desc_t& ep;
};

struct latency_report_t {
  std::string stage_id;
  stage_device_id_t src;
  stage_device_id_t dest;
  double lmean;
  double jitter;
};

struct status_report_t {
  std::string stage_id;
  secret_t pin;
  double serverjitter;
  int portno;
};

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
  ov_server_t(int portno, int prio, const std::string& stage_id);
  ~ov_server_t();
  int portno;
  void announce_new_connection(stage_device_id_t cid, const ep_desc_t& ep);
  void announce_connection_lost(stage_device_id_t cid);
  void announce_latency(stage_device_id_t cid, double lmin, double lmean,
                        double lmax, uint32_t received, uint32_t lost);
  void stop();

  std::function<void(int)> on_ready;
  std::function<void(connection_report_t)> on_connect;
  std::function<void(stage_device_id_t)> on_disconnect;
  std::function<void(latency_report_t)> on_latency;
  std::function<void(status_report_t)> on_status;

private:
  void jittermeasurement_service();
  std::thread jittermeasurement_thread;
  void announce_service();
  std::thread announce_thread;
  void ping_and_callerlist_service();
  std::thread logthread;
  void quitwatch();
  std::thread quitthread;
  void srv();
  std::thread workerthread;
  const int prio;

  secret_t secret;
  ovbox_udpsocket_t socket;
  bool runsession;
  std::string stage_id;

  std::queue<latreport_t> latfifo;
  std::mutex latfifomtx;

  double serverjitter;

  std::string group;
};

#endif // OV_SERVER_H
