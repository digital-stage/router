{
    "targets": [{
        "target_name": "ovserver",
        "sources": [
            "cppsrc/main.cpp",
            "cppsrc/server/ov-server.cpp",
            "cppsrc/server/ov-server.h",
            "cppsrc/server/ov-server-wrapper.cpp",
            "cppsrc/server/ov-server-wrapper.h",
        ],
        "cflags!": [ "-fno-exceptions" ],
        "cflags": [
            "-Wall",
            "-std=c++11",
            "-pthread",
            "-fno-finite-math-only",
            "-ggdb"
          ],
        "cflags_cc!": [ "-fno-exceptions" ],
        "cflags_cc": [
            "-Wall",
            "-std=c++11",
            "-pthread",
            "-fno-finite-math-only",
            "-ggdb"
          ],
        "ldflags": [
        ],
        'include_dirs': [
            "<!@(node -p \"require('node-addon-api').include\")",
            "libov/src"
        ],
        'libraries': [
            "-lcurl",
            "-ldl",
            "-lov",
        ],
        'dependencies': [
            "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        'defines': [
            'OVBOXVERSION="<!(echo $FULLVERSION)"',
            'NAPI_DISABLE_CPP_EXCEPTIONS'
         ],
        'conditions': [
            ['OS=="mac"', {
              'xcode_settings': {
                'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
              }
            }]
          ]
    }]
}
