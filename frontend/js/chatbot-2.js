// TASH AI Chatbot - NAME IT SCENTS
class TashChatbot {
    constructor() {
        this.isOpen = false;
        this.conversationHistory = [];
        this.initializeElements();
        this.bindEvents();
        this.loadConversationHistory();
    }

    initializeElements() {
        this.toggle = document.getElementById('chatbotToggle');
        this.window = document.getElementById('chatbotWindow');
        this.close = document.getElementById('chatbotClose');
        this.messages = document.getElementById('chatbotMessages');
        this.input = document.getElementById('chatbotInput');
        this.send = document.getElementById('chatbotSend');
    }

    bindEvents() {
        this.toggle.addEventListener('click', () => this.toggleChat());
        this.close.addEventListener('click', () => this.closeChat());
        this.send.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.window.classList.add('active');
            this.input.focus();
        } else {
            this.window.classList.remove('active');
        }
    }

    closeChat() {
        this.isOpen = false;
        this.window.classList.remove('active');
    }

    sendMessage() {
        const message = this.input.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        this.input.value = '';

        // Simulate typing delay
        this.showTypingIndicator();

        // Generate AI response
        setTimeout(() => {
            this.hideTypingIndicator();
            const response = this.generateResponse(message);
            this.addMessage(response, 'bot');
        }, 1000 + Math.random() * 1000);
    }

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
        p.textContent = String(text || '');
        content.appendChild(p);

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        this.messages.appendChild(messageDiv);
        this.scrollToBottom();

        // Save to conversation history
        this.conversationHistory.push({ sender, text, timestamp: new Date() });
        this.saveConversationHistory();
    }

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

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    scrollToBottom() {
        this.messages.scrollTop = this.messages.scrollHeight;
    }

    generateResponse(userMessage) {
        const message = userMessage.toLowerCase();
        
        // Product recommendations
        if (message.includes('recommend') || message.includes('suggestion') || message.includes('help me choose')) {
            if (message.includes('men') || message.includes('male') || message.includes('guy')) {
                return "For men, I'd recommend our Classic Black UDT or Club De Nuit Intense. Both are sophisticated fragrances perfect for any occasion. Would you like to know more about their scent profiles?";
            } else if (message.includes('women') || message.includes('female') || message.includes('lady')) {
                return "For women, I'd suggest our Sheer Beauty EDT or AMBER DULCUX LUXP. These are elegant, long-lasting fragrances that are perfect for daily wear. Shall I tell you more about them?";
            } else {
                return "I'd be happy to recommend a perfume! Could you tell me if you're looking for something for men or women, and what type of scent you prefer (fresh, woody, floral, etc.)?";
            }
        }

        // Order tracking
        if (message.includes('track') || message.includes('order') || message.includes('delivery') || message.includes('shipping')) {
            return "To track your order, please visit your user profile page or contact our customer service. You can also check your order status by logging into your account. Would you like me to help you with anything else?";
        }

        // Pricing
        if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
            return "Our perfumes are priced at ₦45 each, offering premium quality at an accessible price point. We also offer bundle deals and seasonal discounts. Would you like to know about our current promotions?";
        }

        // Return policy
        if (message.includes('return') || message.includes('refund') || message.includes('exchange')) {
            return "We offer a 30-day return policy for all our products. If you're not completely satisfied, you can return your purchase for a full refund or exchange. Please ensure the product is in its original packaging.";
        }

        // Scent information
        if (message.includes('scent') || message.includes('fragrance') || message.includes('smell') || message.includes('notes')) {
            return "Our perfumes feature carefully selected notes that create unique and memorable fragrances. Each product has its own distinctive character - from fresh citrus to warm amber. Which specific perfume would you like to know more about?";
        }

        // Store information
        if (message.includes('store') || message.includes('location') || message.includes('address') || message.includes('where')) {
            return "We're located at 123 Perfume Street, Luxury City, LC 12345. You can also reach us at +1 (555) 123-4567 or info@nameitscents.com. We're open Monday to Saturday, 10 AM to 8 PM.";
        }

        // General greeting
        if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
            return "Hello! I'm TASH, your personal AI assistant for NAME IT SCENTS. I can help you find the perfect perfume, track orders, or answer any questions about our products. How can I assist you today?";
        }

        // Thank you
        if (message.includes('thank') || message.includes('thanks')) {
            return "You're very welcome! I'm here to help make your perfume shopping experience as enjoyable as possible. Is there anything else you'd like to know?";
        }

        // Default response
        const defaultResponses = [
            "I'd be happy to help you with that! Could you please provide more details about what you're looking for?",
            "That's a great question! Let me help you find the information you need. Could you be more specific?",
            "I'm here to assist you with all things perfume-related. What would you like to know more about?",
            "I can help you with product recommendations, order tracking, pricing, and more. What specific information are you looking for?"
        ];
        
        return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    }

    saveConversationHistory() {
        localStorage.setItem('tash_conversation', JSON.stringify(this.conversationHistory));
    }

    loadConversationHistory() {
        const saved = localStorage.getItem('tash_conversation');
        if (saved) {
            this.conversationHistory = JSON.parse(saved);
        }
    }
}

// Initialize TASH chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TashChatbot();
});

// Add typing indicator styles
const style = document.createElement('style');
style.textContent = `
    .typing-indicator .message-content p {
        display: flex;
        gap: 4px;
        align-items: center;
    }
    
    .typing-indicator .message-content i {
        width: 6px;
        height: 6px;
        background: #999;
        border-radius: 50%;
        animation: typing 1.4s infinite ease-in-out;
    }
    
    .typing-indicator .message-content i:nth-child(1) { animation-delay: -0.32s; }
    .typing-indicator .message-content i:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes typing {
        0%, 80%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
        }
        40% {
            transform: scale(1);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style); 