#include "JammerServer.cpp"
#include <napi.h>

class JammerServerWrapper : public Napi::ObjectWrap<JammerServerWrapper> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  JammerServerWrapper(const Napi::CallbackInfo& info);

private:
  static Napi::FunctionReference constructor;
  Napi::Value Stop(const Napi::CallbackInfo& info);

  JammerServer* jammerServer_;
};
