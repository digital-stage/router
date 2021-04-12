/*
   Copyright (c) 2019 Christof Ruch. All rights reserved.

   Dual licensed: Distributed under Affero GPL license by default, an MIT license is available for purchase
*/

/*
#include "JuceHeader.h"

#include "JammerNetzPackage.h"

#include "MixerThread.h"
#include "AcceptThread.h"
#include "SendThread.h"
#include "Encryption.h"

#include "BuffersConfig.h"
#include "Recorder.h"

#include "ServerLogger.h"

#include "version.cpp"

#include <curses.h>*/

#include <thread>

static bool quit_jammer(false);

class JammerServer {
public:
	JammerServer(const std::string& cryptoKey, int port, int buffer, int wait, int prefill, const std::string& stageId) : stageId_(stageId), port_(port), buffer_(buffer), wait_(wait), prefill_(prefill) // Setup standard mix down setup - two channels only in stereo
	{
	    // Init jammer server

	    // Then start jammer inside worker thread
        workerThread_ = std::thread(&JammerServer::start, this);
	}

	~JammerServer() {
	}

	void start() {
	    // Start jammer server
	    // Inform node about successful start
	    this->on_ready(port_);
		while (!quit_jammer) {
			std::this_thread::sleep_for(std::chrono::microseconds(2000));
		}
	}

	void stop() {
        quit_jammer = true;
	}

    std::function<void(int)> on_ready;

private:
    std::string stageId_;
    int port_;
    int buffer_;
    int wait_;
    int prefill_;
    std::thread workerThread_;

/*
	DatagramSocket socket_;
	std::unique_ptr<AcceptThread> acceptThread_;
	std::unique_ptr<SendThread> sendThread_;
	std::unique_ptr<MixerThread> mixerThread_;

	TPacketStreamBundle incomingStreams_;
	TOutgoingQueue sendQueue_;
	TMessageQueue wakeUpQueue_;

	Recorder clientRecorder_; // Later I need one per client
	Recorder mixdownRecorder_;
	JammerNetzChannelSetup mixdownSetup_; // This is the same for everybody
	*/
};
