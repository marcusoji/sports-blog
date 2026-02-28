// Contact Form Handler with WhatsApp Integration
// Handles form validation, submission to Supabase, and WhatsApp notifications

class ContactForm {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.successMessage = document.getElementById('successMessage');
        this.supabase = null;
        
        this.init();
    }

    init() {
        // Initialize Supabase
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.supabase) {
            this.supabase = supabase.createClient(
                CONFIG.supabase.url,
                CONFIG.supabase.anonKey
            );
        }

        // Form submission handler
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Real-time validation
        this.setupRealTimeValidation();
    }

    setupRealTimeValidation() {
        const fields = ['name', 'email', 'message'];
        fields.forEach(fieldName => {
            const field = document.getElementById(fieldName);
            if (field) {
                field.addEventListener('blur', () => this.validateField(fieldName));
                field.addEventListener('input', () => this.clearError(fieldName));
            }
        });
    }

    validateField(fieldName) {
        const field = document.getElementById(fieldName);
        const error = document.getElementById(`${fieldName}Error`);
        
        if (!field || !error) return true;

        let isValid = true;
        let errorMessage = '';

        switch (fieldName) {
            case 'name':
                if (field.value.trim().length < 2) {
                    isValid = false;
                    errorMessage = 'Please enter your name (at least 2 characters)';
                }
                break;
            
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(field.value.trim())) {
                    isValid = false;
                    errorMessage = 'Please enter a valid email address';
                }
                break;
            
            case 'message':
                if (field.value.trim().length < 10) {
                    isValid = false;
                    errorMessage = 'Please enter a message (at least 10 characters)';
                }
                break;
        }

        if (!isValid) {
            error.textContent = errorMessage;
            error.style.display = 'block';
            field.style.borderColor = 'var(--color-live)';
        } else {
            error.style.display = 'none';
            field.style.borderColor = 'var(--border-color)';
        }

        return isValid;
    }

    clearError(fieldName) {
        const error = document.getElementById(`${fieldName}Error`);
        const field = document.getElementById(fieldName);
        
        if (error) error.style.display = 'none';
        if (field) field.style.borderColor = 'var(--border-color)';
    }

    validateForm() {
        const nameValid = this.validateField('name');
        const emailValid = this.validateField('email');
        const messageValid = this.validateField('message');
        
        return nameValid && emailValid && messageValid;
    }

    async handleSubmit(e) {
        e.preventDefault();

        // Check honeypot (spam prevention)
        const honeypot = this.form.querySelector('input[name="website"]');
        if (honeypot && honeypot.value) {
            console.log('Spam detected');
            return;
        }

        // Validate form
        if (!this.validateForm()) {
            return;
        }

        // Disable submit button
        this.setSubmitState(true);

        // Get form data
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            department: document.getElementById('department').value.trim(),
            message: document.getElementById('message').value.trim(),
            ip_address: await this.getClientIP()
        };

        try {
            // Save to Supabase
            const submissionId = await this.saveToSupabase(formData);
            
            // Send WhatsApp notifications
            await this.sendWhatsAppNotifications(formData, submissionId);
            
            // Show success message
            this.showSuccess();
            
            // Reset form
            this.form.reset();
            
        } catch (error) {
            console.error('Submission error:', error);
            this.showError('An error occurred. Please try again or contact us directly at info@mockuniversity.com');
        } finally {
            this.setSubmitState(false);
        }
    }

    async saveToSupabase(formData) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        const { data, error } = await this.supabase
            .from('contact_submissions')
            .insert([formData])
            .select();

        if (error) throw error;
        
        return data[0].id;
    }

    async sendWhatsAppNotifications(formData, submissionId) {
        // Format message for WhatsApp
        const message = this.formatWhatsAppMessage(formData, submissionId);
        
        // Get WhatsApp recipient numbers from config
        const recipients = CONFIG.whatsapp.recipients || ['+2349042007583', '+2349159048395'];
        
        // Send to each recipient via backend API
        const promises = recipients.map(recipient => 
            this.sendWhatsAppMessage(recipient, message)
        );
        
        const results = await Promise.allSettled(promises);
        
        // Update Supabase with WhatsApp status
        const successfulNumbers = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successfulNumbers.push(recipients[index]);
            }
        });
        
        if (this.supabase && submissionId) {
            await this.supabase
                .from('contact_submissions')
                .update({
                    whatsapp_sent: successfulNumbers.length > 0,
                    whatsapp_numbers: successfulNumbers
                })
                .eq('id', submissionId);
        }
        
        return successfulNumbers.length > 0;
    }

    formatWhatsAppMessage(formData, submissionId) {
        return `
🎓 *New Contact Form Submission*

*Name:* ${formData.name}
*Email:* ${formData.email}
${formData.department ? `*Department:* ${formData.department}` : ''}

*Message:*
${formData.message}

*Submission ID:* ${submissionId}
*Time:* ${new Date().toLocaleString()}

_Reply to this message or contact directly at ${formData.email}_
        `.trim();
    }

    async sendWhatsAppMessage(recipient, message) {
        // This function sends a WhatsApp message via backend API
        // You can use Twilio, WhatsApp Business API, or similar services
        
        try {
            // Method 1: Using Twilio (requires backend API)
            const response = await fetch('/api/send-whatsapp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: recipient,
                    message: message
                })
            });
            
            if (!response.ok) {
                throw new Error('WhatsApp API request failed');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error(`Failed to send WhatsApp to ${recipient}:`, error);
            
            // Fallback: Open WhatsApp Web with pre-filled message
            // This is a client-side fallback that opens WhatsApp in browser
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/${recipient.replace(/\+/g, '')}?text=${encodedMessage}`;
            
            // Only open one WhatsApp link to avoid browser popup blocking
            if (recipient === CONFIG.whatsapp.recipients[0]) {
                console.log('Opening WhatsApp Web fallback:', whatsappUrl);
                // Uncomment to enable automatic opening:
                // window.open(whatsappUrl, '_blank');
            }
            
            throw error;
        }
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    setSubmitState(isSubmitting) {
        const submitText = document.getElementById('submitText');
        const submitLoader = document.getElementById('submitLoader');
        
        if (isSubmitting) {
            this.submitBtn.disabled = true;
            submitText.style.display = 'none';
            submitLoader.style.display = 'inline-block';
        } else {
            this.submitBtn.disabled = false;
            submitText.style.display = 'inline';
            submitLoader.style.display = 'none';
        }
    }

    showSuccess() {
        this.successMessage.style.display = 'block';
        
        // Scroll to success message
        this.successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Hide after 5 seconds
        setTimeout(() => {
            this.successMessage.style.display = 'none';
        }, 5000);
        
        // Show toast
        if (window.mockUniversity) {
            window.mockUniversity.showToast('Message sent successfully!', 'success');
        }
    }

    showError(message) {
        if (window.mockUniversity) {
            window.mockUniversity.showToast(message, 'error');
        } else {
            alert(message);
        }
    }
}

// Initialize contact form when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.contactForm = new ContactForm();
});