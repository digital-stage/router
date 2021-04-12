#include "napi-thread-safe-callback.hpp"
#include <chrono>
#include <iostream>
#include <thread>

#include "JammerServerWrapper.h"

Napi::FunctionReference JammerServerWrapper::constructor;

Napi::Object JammerServerWrapper::Init(Napi::Env env, Napi::Object exports)
{
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(
      env, "JammerServerWrapper", {InstanceMethod("stop", &JammerServerWrapper::Stop)});

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("JammerServerWrapper", func);
  return exports;
}

JammerServerWrapper::JammerServerWrapper(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<JammerServerWrapper>(info)
{
  Napi::Env env = info.Env();
  int length = info.Length();

  if(length != 6) {
    Napi::TypeError::New(env, "Four arguments expected")
        .ThrowAsJavaScriptException();
  }

  // port
  if(!info[1].IsNumber()) {
    Napi::TypeError::New(env, "Second argument is not a number")
        .ThrowAsJavaScriptException();
  }
  // buffer
  if(!info[2].IsNumber()) {
    Napi::TypeError::New(env, "Third argument is not a number")
        .ThrowAsJavaScriptException();
  }
  // wait
  if(!info[3].IsNumber()) {
    Napi::TypeError::New(env, "Forth argument is not a number")
        .ThrowAsJavaScriptException();
  }
  // prefill
  if(!info[4].IsNumber()) {
    Napi::TypeError::New(env, "Fifth argument is not a number")
        .ThrowAsJavaScriptException();
  }

  // Initialize class
  Napi::String cryptoKey = info[0].As<Napi::String>();
  Napi::Number portno = info[1].As<Napi::Number>();
  Napi::Number buffer = info[2].As<Napi::Number>();
  Napi::Number wait = info[3].As<Napi::Number>();
  Napi::Number prefill = info[4].As<Napi::Number>();
  Napi::String stage_id = info[5].As<Napi::String>();

  this->jammerServer_ =
      new JammerServer(cryptoKey, portno.DoubleValue(), buffer.DoubleValue(), wait.DoubleValue(), prefill.DoubleValue(), stage_id);

  // Bind events
  Napi::Function emit =
      info.This().As<Napi::Object>().Get("emit").As<Napi::Function>();

  auto callback = std::make_shared<ThreadSafeCallback>(
      info.This().As<Napi::Object>(),
      info.This().As<Napi::Object>().Get("emit").As<Napi::Function>());
  // emit.Call(_self, { Napi::String::New(env, "ready") });

  Napi::Object _self = info.This().As<Napi::Object>();

  this->jammerServer_->on_ready = [callback](int port) {
    std::cout << "READY" << std::endl;

    // Call back with result
    callback->call([port](Napi::Env env, std::vector<napi_value>& args) {
      args = {Napi::String::New(env, "ready"), Napi::Number::New(env, port)};
    });
  };
}

Napi::Value JammerServerWrapper::Stop(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();
  this->jammerServer_->stop();
  return Napi::String::New(env, "stopped");
}
