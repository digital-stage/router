#!/bin/bash
VERSION=$(grep -m 1 VERSION libov/Makefile|sed 's/^.*=//g')
MINORVERSION=$(git rev-list --count HEAD)
COMMIT=$(git rev-parse --short HEAD)
COMMITMOD=$(test -z "`git status --porcelain -uno`" || echo "-modified")
FULLVERSION=$VERSION.$MINORVERSION-$COMMIT$COMMITMOD

UNAME_M=$(uname -m)
if [[ $UNAME_M == "x86_64" ]]; then
  ARCH=AMD64
elif [[ $UNAME_M == "i386" ]]; then
  ARCH=IA32
elif [[ $UNAME_M == arm* ]]; then
  ARCH=ARM
fi
echo $ARCH
