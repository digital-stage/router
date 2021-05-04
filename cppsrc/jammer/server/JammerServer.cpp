#include "JammerServer.h"
#include <iostream>

static bool quit_jammer(false);

JammerServer::JammerServer(const std::string& cryptoKey, int port, int buffer, int wait, int prefill, const std::string& stageId) : stageId_(stageId), port_(port), buffer_(buffer), wait_(wait), prefill_(prefill) // Setup standard mix down setup - two channels only in stereo
	{
	    // Init jammer server

	    // Then start jammer inside worker thread
	    std::cout << "Buffer: " << buffer_ << std::endl;
	    std::cout << "Prefill: " << prefill_ << std::endl;
	    std::cout << "Wait: " << wait_ << std::endl;
        workerThread_ = std::thread(&JammerServer::start, this);
	}

JammerServer::~JammerServer() {
}

void JammerServer::start() {
    // Start jammer server
    // Inform node about successful start
    this->on_ready(port_);
    while (!quit_jammer) {
        std::this_thread::sleep_for(std::chrono::microseconds(2000));
    }
}


void JammerServer::stop() {
    quit_jammer = true;
}