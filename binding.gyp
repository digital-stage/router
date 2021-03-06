{
    "targets": [
        {
        "target_name": "jammerserver",
        'cflags!': [ '-fno-exceptions' ],
        'cflags_cc!': [ '-fno-exceptions' ],
        "sources": [
            "cppsrc/jammer/main.cpp",
            "cppsrc/jammer/server/JammerServer.cpp",
            "cppsrc/jammer/server/JammerServerWrapper.cpp",
        ],
        'include_dirs': [
            "<!@(node -p \"require('node-addon-api').include\")",
            "<!@(node -p \"require('napi-thread-safe-callback').include\")",
            "<!(pwd)/jammer/common",
            "<!(pwd)/jammer/Server/Source",
            '<!(pwd)/jammer/third_party/JUCE/modules'
        ],
        'libraries': [
            "-lcurl",
            "-ldl",
            "-lpthread"
        ],
        'dependencies': [
            "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        'defines': [
            'NAPI_CPP_EXCEPTIONS'
         ],
        'conditions': [
            ['OS=="mac"', {
              'xcode_settings': {
                'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
              },
              'defines': [
                'OSX'
              ]
            }],
            ['OS=="linux"', {
              'cflags_cc': [
                "-ext-numeric-literals",
              ]
            }]
        ]
        },
        {
        "target_name": "ovserver",
        "sources": [
            "cppsrc/ov/main.cpp",
            "cppsrc/ov/server/ov-server.cpp",
            "cppsrc/ov/server/ov-server-wrapper.cpp",
        ],
        "cflags!": [ "-fno-exceptions" ],
        "cflags_cc!": [ "-fno-exceptions" ],
        "cflags": [
            "-Wall",
            "-fno-finite-math-only",
            "-ext-numeric-literals",
            "-fPIC"
          ],
        "cflags_cc": [
            "-Wall",
            "-Wno-deprecated-declarations",
            "-fno-finite-math-only",
            "-ext-numeric-literals",
            "-std=c++11",
            "-pthread",
            "-ggdb",
            "-fPIC"
          ],
        'include_dirs': [
            "<!@(node -p \"require('node-addon-api').include\")",
            "<!@(node -p \"require('napi-thread-safe-callback').include\")",
            "<!(pwd)/libov/src"
        ],
        'libraries': [
            "-lcurl",
            "-ldl",
             "<!(pwd)/libov/build/libov.a"
        ],
        'dependencies': [
            "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        'defines': [
            'NAPI_CPP_EXCEPTIONS',
            'OVBOXVERSION="0.3"'
         ],
        'conditions': [
            ['"$ARCH"=="AMD64"', {
               'defined': [
                'AMD64'
               ]
            }],
            ['"$ARCH"=="IA32"', {
               'defined': [
                'IA32'
               ]
            }],
            ['"$ARCH"=="ARM"', {
               'defined': [
                'ARM'
               ]
            }],
            ['OS=="win"', {
              'defines': [
                'WIN32'
              ]
            }],
            ['OS=="mac"', {
              'xcode_settings': {
                'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
              },
              'defines': [
                'OSX'
              ]
            }],
            ['OS=="linux"', {
              'defines': [
                'LINUX'
              ]
            }]
        ]
    }]
}
