#!/bin/sh
cd jammer
cmake -S . -B builds -G "Unix Makefiles"
cd third_party/flatbuffers
cmake -S . -B LinuxBuilds -G "Unix Makefiles"
cmake --build LinuxBuilds
cd ../..
cmake --build builds/Server/
