#include <napi.h>
#include "ov-server.h"

class OvServerWrapper : public Napi::ObjectWrap<OvServerWrapper> {
    public:
         static Napi::Object Init(Napi::Env env, Napi::Object exports);
         OvServerWrapper(const Napi::CallbackInfo& info);
         //~NativeEmitter();

     private:
         static Napi::FunctionReference constructor;
         Napi::Value Stop(const Napi::CallbackInfo& info);

         ov_server_t *ov_server_;
};
