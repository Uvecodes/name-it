/**
 * TASH AI Chatbot - NAME IT SCENTS
 * Voice-enabled AI chatbot with Gemini integration
 */

class TashChatbot {
  constructor() {
    this.isOpen = false;
    this.conversationHistory = [];
    this.voiceEnabled = false;  // Voice output off by default
    this.isRecording = false;
    this.isSpeaking = false;
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    const apiBase = window.API_BASE_URL || 'http://localhost:3030/api';
    this.API_URL = `${String(apiBase).replace(/\/$/, '')}/chat`;
    this.chatSessionId = sessionStorage.getItem('tash_chat_session_id') || null;
    
    this.initializeElements();
    this.initializeSpeechRecognition();
    this.bindEvents();
    this.loadConversationHistory();
  }

  /**
   * Initialize DOM elements
   */
  initializeElements() {
    this.toggle = document.getElementById('chatbotToggle');
    this.window = document.getElementById('chatbotWindow');
    this.close = document.getElementById('chatbotClose');
    this.messages = document.getElementById('chatbotMessages');
    this.input = document.getElementById('chatbotInput');
    this.send = document.getElementById('chatbotSend');
    this.mic = document.getElementById('chatbotMic');
    this.voiceToggle = document.getElementById('chatbotVoiceToggle');
    this.speakingIndicator = document.getElementById('speakingIndicator');
  }

  /**
   * Initialize Web Speech Recognition
   */
  initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      if (this.mic) {
        this.mic.style.display = 'none';
      }
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isRecording = true;
      if (this.mic) {
        this.mic.classList.add('recording');
        this.mic.innerHTML = '<i class="fas fa-stop"></i>';
      }
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      if (this.mic) {
        this.mic.classList.remove('recording');
        this.mic.innerHTML = '<i class="fas fa-microphone"></i>';
      }
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        this.input.value = transcript;
        this.sendMessage();
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isRecording = false;
      if (this.mic) {
        this.mic.classList.remove('recording');
        this.mic.innerHTML = '<i class="fas fa-microphone"></i>';
      }
      
      if (event.error === 'not-allowed') {
        this.addMessage('Microphone access denied. Please allow microphone access to use voice input.', 'bot');
      }
    };
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    if (this.toggle) {
      this.toggle.addEventListener('click', () => this.toggleChat());
    }
    
    if (this.close) {
      this.close.addEventListener('click', () => this.closeChat());
    }
    
    if (this.send) {
      this.send.addEventListener('click', () => this.sendMessage());
    }
    
    if (this.input) {
      this.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    if (this.mic) {
      this.mic.addEventListener('click', () => this.toggleRecording());
    }

    if (this.voiceToggle) {
      this.voiceToggle.addEventListener('click', () => this.toggleVoice());
    }

    // Stop speaking when user starts typing
    if (this.input) {
      this.input.addEventListener('input', () => {
        if (this.isSpeaking) {
          this.stopSpeaking();
        }
      });
    }
  }

  /**
   * Toggle chat window
   */
  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.window.classList.add('active');
      this.input.focus();
    } else {
      this.window.classList.remove('active');
      this.stopSpeaking();
    }
  }

  /**
   * Close chat window
   */
  closeChat() {
    this.isOpen = false;
    this.window.classList.remove('active');
    this.stopSpeaking();
  }

  /**
   * Toggle voice recording
   */
  toggleRecording() {
    if (!this.recognition) {
      this.addMessage('Voice input is not supported in your browser. Please use Chrome or Edge.', 'bot');
      return;
    }

    if (this.isRecording) {
      this.recognition.stop();
    } else {
      // Stop any ongoing speech first
      this.stopSpeaking();
      
      try {
        this.recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    }
  }

  /**
   * Toggle voice output
   */
  toggleVoice() {
    this.voiceEnabled = !this.voiceEnabled;
    
    if (this.voiceToggle) {
      if (this.voiceEnabled) {
        this.voiceToggle.classList.add('active');
        this.voiceToggle.innerHTML = '<i class="fas fa-volume-up"></i>';
        this.voiceToggle.title = 'Voice On (click to mute)';
      } else {
        this.voiceToggle.classList.remove('active');
        this.voiceToggle.innerHTML = '<i class="fas fa-volume-mute"></i>';
        this.voiceToggle.title = 'Voice Off (click to enable)';
        this.stopSpeaking();
      }
    }
  }

  /**
   * Speak text using Web Speech Synthesis
   */
  speak(text) {
    if (!this.voiceEnabled || !this.synthesis) return;

    // Stop any ongoing speech
    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;  // Slightly higher pitch for feminine voice
    utterance.volume = 1.0;

    // Prefer feminine voices - priority order
    const feminineVoiceKeywords = [
      'female', 'woman', 'Samantha', 'Victoria', 'Karen', 
      'Moira', 'Tessa', 'Fiona', 'Zira', 'Hazel', 'Susan',
      'Google UK English Female', 'Google US English Female',
      'Microsoft Zira', 'Microsoft Hazel'
    ];

    const voices = this.synthesis.getVoices();
    
    // First, try to find a voice matching feminine keywords
    let preferredVoice = null;
    
    for (const keyword of feminineVoiceKeywords) {
      preferredVoice = voices.find(v => 
        v.name.toLowerCase().includes(keyword.toLowerCase())
      );
      if (preferredVoice) break;
    }

    // Fallback: find any English female voice
    if (!preferredVoice) {
      preferredVoice = voices.find(v => 
        v.lang.startsWith('en') && 
        (v.name.toLowerCase().includes('female') || 
         v.name.toLowerCase().includes('woman'))
      );
    }

    // Last fallback: any English voice
    if (!preferredVoice) {
      preferredVoice = voices.find(v => v.lang.startsWith('en'));
    }

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      console.log('Using voice:', preferredVoice.name);
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.speakingIndicator) {
        this.speakingIndicator.classList.add('active');
      }
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.speakingIndicator) {
        this.speakingIndicator.classList.remove('active');
      }
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (this.speakingIndicator) {
        this.speakingIndicator.classList.remove('active');
      }
    };

    this.synthesis.speak(utterance);
  }

  /**
   * Stop speaking
   */
  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    this.isSpeaking = false;
    if (this.speakingIndicator) {
      this.speakingIndicator.classList.remove('active');
    }
  }

  /**
   * Send message to AI
   */
  async sendMessage() {
    const message = this.input.value.trim();
    if (!message) return;

    // Add user message to chat
    this.addMessage(message, 'user');
    this.input.value = '';

    // Disable input while processing
    this.input.disabled = true;
    this.send.disabled = true;

    // Show typing indicator
    this.showTypingIndicator();

    try {
      const response = await this.generateResponse(message);
      this.hideTypingIndicator();
      this.addMessage(response, 'bot');
      
      // Speak the response if voice is enabled
      if (this.voiceEnabled) {
        this.speak(response);
      }
    } catch (error) {
      console.error('TASH chatbot failed to respond:', error);
      this.hideTypingIndicator();
      const errorMessage = 'Sorry, I ran into a problem. Please try again.';
      this.addMessage(errorMessage, 'bot');
    }

    // Re-enable input
    this.input.disabled = false;
    this.send.disabled = false;
    this.input.focus();
  }

  /**
   * Add message to chat
   */
  addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    
    if (sender === 'bot') {
      avatar.innerHTML = '<i class="fas fa-robot"></i>';
    } else {
      avatar.innerHTML = '<i class="fas fa-user"></i>';
    }

    const content = document.createElement('div');
    content.className = 'message-content';
    const p = document.createElement('p');
    const lines = String(text || '').split('\n');
    lines.forEach((line, idx) => {
      p.appendChild(document.createTextNode(line));
      if (idx < lines.length - 1) {
        p.appendChild(document.createElement('br'));
      }
    });
    content.appendChild(p);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    this.messages.appendChild(messageDiv);
    this.scrollToBottom();

    // Save to conversation history
    this.conversationHistory.push({ sender, text, timestamp: new Date() });
    this.saveConversationHistory();
  }

  /**
   * Show typing indicator
   */
  showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.id = 'typing-indicator';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<i class="fas fa-robot"></i>';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = '<p><i class="fas fa-circle"></i><i class="fas fa-circle"></i><i class="fas fa-circle"></i></p>';

    typingDiv.appendChild(avatar);
    typingDiv.appendChild(content);
    this.messages.appendChild(typingDiv);
    this.scrollToBottom();
  }

  /**
   * Hide typing indicator
   */
  hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  /**
   * Scroll to bottom of messages
   */
  scrollToBottom() {
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  /**
   * Generate response from backend API
   */
  async generateResponse(userMessage) {
    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          message: userMessage,
          ...(this.chatSessionId ? { sessionId: this.chatSessionId } : {}),
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return "I'm getting a lot of messages right now. Please wait a moment and try again.";
        }
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.reply) {
        throw new Error('No reply in response');
      }

      if (data.sessionId) {
        this.chatSessionId = data.sessionId;
        sessionStorage.setItem('tash_chat_session_id', data.sessionId);
      }

      return data.reply;
    } catch (error) {
      console.error('Error calling chat API:', error);
      return this.generateFallbackResponse(userMessage);
    }
  }

  /**
   * Generate fallback response when API fails
   */
  generateFallbackResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('recommend') || message.includes('suggestion') || message.includes('help me choose')) {
      if (message.includes('men') || message.includes('male') || message.includes('guy')) {
        return "For men, I'd recommend our Classic Black UDT or Club De Nuit Intense. Both are sophisticated fragrances perfect for any occasion.";
      } else if (message.includes('women') || message.includes('female') || message.includes('lady')) {
        return "For women, I'd suggest our Sheer Beauty EDT or AMBER DULCUX LUXP. These are elegant, long-lasting fragrances perfect for daily wear.";
      } else {
        return "I'd be happy to recommend a perfume! Are you looking for something for men or women? And do you prefer fresh, woody, or floral scents?";
      }
    }

    if (message.includes('track') || message.includes('order') || message.includes('delivery') || message.includes('shipping')) {
      return "To track your order, visit your profile page where all your orders are listed. You can also contact our customer service for help.";
    }

    if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
      return "Prices vary by product. Please check our collection page for current prices. We also offer free shipping on orders above ₦50,000!";
    }

    if (message.includes('return') || message.includes('refund') || message.includes('exchange')) {
      return "We offer returns within 14 days of delivery for unopened products. Contact our customer service to initiate a return.";
    }

    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
      return "Hello! I'm TASH, your AI assistant for NAME IT SCENTS. I can help you find the perfect perfume, track orders, or answer questions. How can I help?";
    }

    if (message.includes('thank')) {
      return "You're welcome! Is there anything else I can help you with?";
    }

    const defaultResponses = [
      "I'd be happy to help! Could you tell me more about what you're looking for?",
      "That's a great question! Let me help you find the information you need.",
      "I can help with product recommendations, order tracking, and more. What would you like to know?"
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  }

  /**
   * Save conversation history to localStorage
   */
  saveConversationHistory() {
    // Only keep last 50 messages
    const historyToSave = this.conversationHistory.slice(-50);
    localStorage.setItem('tash_conversation', JSON.stringify(historyToSave));
  }

  /**
   * Load conversation history from localStorage
   */
  loadConversationHistory() {
    try {
      const saved = localStorage.getItem('tash_conversation');
      if (saved) {
        this.conversationHistory = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
      this.conversationHistory = [];
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.chatSessionId = null;
    sessionStorage.removeItem('tash_chat_session_id');
    localStorage.removeItem('tash_conversation');
    
    // Clear messages display except welcome message
    if (this.messages) {
      const welcomeMessage = this.messages.querySelector('.bot-message');
      this.messages.innerHTML = '';
      if (welcomeMessage) {
        this.messages.appendChild(welcomeMessage);
      }
    }
  }
}

// Initialize TASH chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Load voices for speech synthesis
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
  
  // Initialize chatbot
  window.tashChatbot = new TashChatbot();
});
