#include <chrono>
#include <thread>
#include <iostream>
#include "napi-thread-safe-callback.hpp"

#include "ov-server-wrapper.h"

Napi::FunctionReference OvServerWrapper::constructor;

Napi::Object OvServerWrapper::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "OvServerWrapper", {
    InstanceMethod("stop", &OvServerWrapper::Stop)
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("OvServerWrapper", func);
  return exports;
}

OvServerWrapper::OvServerWrapper(const Napi::CallbackInfo& info)
: Napi::ObjectWrap<OvServerWrapper>(info)  {
  Napi::Env env = info.Env();
  int length = info.Length();

  if (length != 3) {
    Napi::TypeError::New(env, "Three arguments expected").ThrowAsJavaScriptException();
  }

  if(!info[0].IsNumber()){
    Napi::TypeError::New(env, "First argument is not a number").ThrowAsJavaScriptException();
  }
  if(!info[1].IsNumber()){
    Napi::TypeError::New(env, "Second argument is not a number").ThrowAsJavaScriptException();
  }

  // Initialize class
  Napi::Number portno = info[0].As<Napi::Number>();
  Napi::Number prio = info[1].As<Napi::Number>();
  Napi::String stage_id = info[2].As<Napi::String>();
  this->ov_server_ = new ov_server_t(portno.DoubleValue(), prio.DoubleValue(), stage_id);

  // Bind events
  Napi::Function emit = info.This().As<Napi::Object>().Get("emit").As<Napi::Function>();

  auto callback = std::make_shared<ThreadSafeCallback>(info.This().As<Napi::Object>(), info.This().As<Napi::Object>().Get("emit").As<Napi::Function>());
  //emit.Call(_self, { Napi::String::New(env, "ready") });

  Napi::Object _self =  info.This().As<Napi::Object>();

  this->ov_server_->on_ready = [callback](int port){
    std::cout << "READY" << std::endl;

    // Call back with result
    callback->call([port](Napi::Env env, std::vector<napi_value>& args)
    {
        args = { Napi::String::New(env, "ready"), Napi::Number::New(env, port) };
    });
  };

  this->ov_server_->on_connect = [callback](connection_report_t report){
    std::cout << "ON_CONNECT" << std::endl;

    // Call back with result
    callback->call([report](Napi::Env env, std::vector<napi_value>& args)
    {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("stageId", report.stage_id);
        obj.Set("ovStageDeviceId", report.cid);
        obj.Set("version", report.ep.version);
        obj.Set("ip", report.ep.ep.sin_addr.s_addr);
        obj.Set("localIp", report.ep.localep.sin_addr.s_addr);
        obj.Set("announced", report.ep.announced);
        obj.Set("minPing", report.ep.pingt_min);
        obj.Set("maxPing", report.ep.pingt_max);
        obj.Set("meanPing", report.ep.pingt_sum);
        obj.Set("received", report.ep.num_received);
        obj.Set("lost", report.ep.num_lost);
        args = { Napi::String::New(env, "connect"), obj };
    });
  };

  this->ov_server_->on_latency = [callback](latency_report_t report){
    std::cout << "ON_DISCONNECT" << std::endl;

    // Call back with result
    callback->call([report](Napi::Env env, std::vector<napi_value>& args)
    {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("stageId", report.stage_id);
        obj.Set("srcOvStageDevceId", report.src);
        obj.Set("destOvStageDeviceId", report.dest);
        obj.Set("latency", report.lmean);
        obj.Set("jitter", report.jitter);
        args = { Napi::String::New(env, "latency"), obj };
    });
  };

  this->ov_server_->on_status = [callback](status_report_t report){
    std::cout << "ON_STATUS" << std::endl;

    // Call back with result
    callback->call([report](Napi::Env env, std::vector<napi_value>& args)
    {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("stageId", report.stage_id);
        obj.Set("pin", report.pin);
        obj.Set("serverjitter", report.serverjitter);
        obj.Set("port", report.portno);
        args = { Napi::String::New(env, "status"), obj };
    });
  };

  this->ov_server_->on_disconnect = [callback](stage_device_id_t id){
    std::cout << "ON_DISCONNECT" << std::endl;

    // Call back with result
    callback->call([id](Napi::Env env, std::vector<napi_value>& args)
    {
        args = { Napi::String::New(env, "disconnect"), Napi::Number::New(env, id) };
    });
  };
}

Napi::Value OvServerWrapper::Stop(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  this->ov_server_->stop();
  return Napi::String::New(env, "stopped");
}