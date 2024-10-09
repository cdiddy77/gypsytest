"use client";
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import base64js from "base64-js";
import AudioChatbot from "@/components/audio-chatbot/audio-chatbot";

function App() {
  return <AudioChatbot />;
}
export default App;
