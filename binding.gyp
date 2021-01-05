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
            "-fno-finite-math-only",
            "-Wno-deprecated-declarations",
            "-std=c++11",
            "-pthread",
            "-ggdb"
          ],
        "ldflags": [
            "-Llibov/build"
        ],
        'include_dirs': [
            "<!@(node -p \"require('node-addon-api').include\")",
            "libov/src"
        ],
        'libraries': [
            "-lcurl",
            "-ldl",
            "-L<!(pwd)/libov/build/"
        ],
        'dependencies': [
            "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        'defines': [
            'OVBOXVERSION="<!(echo $FULLVERSION)"',
            'OVBOXVERSION="<!(echo $FULLVERSION)"'
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
              'cflags_cc': [
                "-ext-numeric-literals",
              ],
              'defines': [
                'LINUX'
              ]
            }]
        ]
    }]
}
