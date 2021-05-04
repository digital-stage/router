/*
   Copyright (c) 2019 Christof Ruch. All rights reserved.

   Dual licensed: Distributed under Affero GPL license by default, an MIT license is available for purchase
*/

#ifndef JAMMER_SERVER_H
#define JAMMER_SERVER_H

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
#include <functional>
#include <string>


class JammerServer {
public:
	JammerServer(const std::string& cryptoKey, int port, int buffer, int wait, int prefill, const std::string& stageId);
	~JammerServer();

	void start();

	void stop();

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

#endif // JAMMER_SERVER_H
