class FacebookAdsGenerator {
    constructor() {
        this.form = document.getElementById('businessForm');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.results = document.getElementById('results');
        this.downloadBtn = document.getElementById('downloadBtn');
        
        this.apiKeySection = document.getElementById('apiKeySection');
        this.apiKeyInput = document.getElementById('apiKey');
        this.saveApiKeyBtn = document.getElementById('saveApiKey');
        this.configurationError = document.getElementById('configurationError');
        this.inputSection = document.querySelector('.input-section');
        
        this.progressContainer = document.getElementById('progressContainer');
        this.themeToggle = document.getElementById('themeToggle');
        
        this.initializeApiKey();
        this.initializeEventListeners();
        this.initializeTheme();
    }

    initializeApiKey() {
        const savedApiKey = localStorage.getItem('openRouterApiKey');
        if (savedApiKey) {
            this.apiKeyInput.value = savedApiKey;
            this.apiKeySection.classList.add('hidden');
            this.inputSection.classList.remove('hidden');
            this.configurationError.classList.add('hidden');
        } else {
            this.inputSection.classList.add('hidden');
            this.configurationError.classList.remove('hidden');
        }
    }

    initializeEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        this.downloadBtn.addEventListener('click', () => this.downloadReport());
        this.saveApiKeyBtn.addEventListener('click', () => this.handleSaveApiKey());
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    updateProgress(step) {
        const steps = this.progressContainer.querySelectorAll('.progress-step');
        steps.forEach((stepEl, index) => {
            if (index + 1 < step) {
                stepEl.classList.remove('active');
                stepEl.classList.add('completed');
            } else if (index + 1 === step) {
                stepEl.classList.add('active');
                stepEl.classList.remove('completed');
            } else {
                stepEl.classList.remove('active', 'completed');
            }
        });
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = {
            businessType: document.getElementById('businessType').value,
            description: document.getElementById('description').value,
            goals: document.getElementById('goals').value,
            budget: document.getElementById('budget').value
        };

        this.showLoading();
        this.progressContainer.classList.remove('hidden');
        
        try {
            this.updateProgress(1);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
            
            this.updateProgress(2);
            const recommendations = await this.generateRecommendations(formData);
            
            this.updateProgress(3);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate formatting
            
            this.displayResults(recommendations);
        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'Error generating recommendations. Please try again.');
        } finally {
            this.hideLoading();
            this.progressContainer.classList.add('hidden');
        }
    }

    async generateRecommendations(formData) {
        const apiKey = localStorage.getItem('openRouterApiKey');
        if (!apiKey) {
            throw new Error('API key not configured');
        }

        const prompt = this.createPrompt(formData);
        
        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Facebook Ads Manager Generator'
                },
                body: JSON.stringify({
                    model: CONFIG.MODEL,
                    messages: [{
                        role: 'user',
                        content: [{
                            type: 'text',
                            text: prompt
                        }]
                    }],
                    stream: false,
                    max_tokens: 4000,
                    temperature: 0.7
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error('API Error:', data.error);
                if (data.error.message) {
                    throw new Error(`API Error: ${data.error.message}`);
                } else {
                    throw new Error('An error occurred while communicating with the API');
                }
            }

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('openRouterApiKey');
                    this.apiKeySection.classList.remove('hidden');
                    this.inputSection.classList.add('hidden');
                    throw new Error('Invalid API key. Please reconfigure.');
                }
                throw new Error(`API request failed with status ${response.status}`);
            }

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error('Unexpected API response:', data);
                throw new Error('Invalid response format from API');
            }

            // Extract the text content from the response
            const messageContent = data.choices[0].message.content;
            const textContent = Array.isArray(messageContent) 
                ? messageContent.find(c => c.type === 'text')?.text 
                : messageContent;

            if (!textContent) {
                throw new Error('No text content in response');
            }

            return this.parseAIResponse(textContent);
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    createPrompt(formData) {
        return `As a Facebook Ads expert, create a JSON response with recommendations for the following business:
            Business Type: ${formData.businessType}
            Description: ${formData.description}
            Goals: ${formData.goals}
            Monthly Budget: $${formData.budget}

            The JSON response should have these exact keys:
            {
                "adObjective": "detailed recommendation",
                "audienceTargeting": {
                    "demographics": {
                        "age": "recommended age ranges",
                        "gender": "gender targeting recommendation",
                        "locations": "geographic targeting",
                        "languages": "language preferences"
                    },
                    "interests": {
                        "primary": ["list of primary interests"],
                        "secondary": ["list of secondary interests"]
                    },
                    "behaviors": ["list of relevant behaviors"],
                    "customAudiences": "recommendations for custom audiences",
                    "lookalikeAudiences": "lookalike audience suggestions",
                    "exclusions": "groups to exclude",
                    "audienceSize": "estimated audience size range"
                },
                "adCopy": "sample headlines and descriptions",
                "visualAssets": "creative ideas",
                "budgetAllocation": "budget strategy",
                "campaignStructure": "structure details",
                "abTesting": "testing strategy",
                "performanceTracking": "tracking recommendations"
            }

            Provide specific, actionable targeting recommendations based on the business type and goals. Include both broad and narrow targeting options.
            For interests and behaviors, provide actual targetable Facebook categories.
            Ensure the response is valid JSON format.`;
    }

    parseAIResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : response;
            
            const parsed = JSON.parse(jsonStr);
            
            const requiredKeys = [
                'adObjective',
                'audienceTargeting',
                'adCopy',
                'visualAssets',
                'budgetAllocation',
                'campaignStructure',
                'abTesting',
                'performanceTracking'
            ];
            
            const missingKeys = requiredKeys.filter(key => !(key in parsed));
            if (missingKeys.length > 0) {
                throw new Error(`Missing required keys: ${missingKeys.join(', ')}`);
            }
            
            return parsed;
        } catch (error) {
            console.error('Error parsing AI response:', error);
            console.error('Raw response:', response);
            throw new Error('Failed to parse API response into valid JSON format');
        }
    }

    displayResults(recommendations) {
        const sections = [
            'adObjective',
            'audienceTargeting',
            'adCopy',
            'visualAssets',
            'budgetAllocation',
            'campaignStructure',
            'abTesting',
            'performanceTracking'
        ];

        sections.forEach(section => {
            const element = document.getElementById(section);
            let content;

            if (section === 'audienceTargeting') {
                content = this.formatAudienceTargeting(recommendations[section]);
            } else {
                content = this.formatContent(recommendations[section]);
            }

            element.innerHTML = `
                <h3>${this.formatSectionTitle(section)}</h3>
                <div>${content}</div>
            `;
        });

        this.results.classList.remove('hidden');
    }

    formatSectionTitle(section) {
        return section
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    }

    formatContent(content) {
        if (typeof content === 'string') {
            return content.replace(/\n/g, '<br>');
        }
        return content;
    }

    formatAudienceTargeting(targeting) {
        return `
            <div class="targeting-section">
                <h4>Demographics</h4>
                <ul>
                    <li><strong>Age:</strong> ${targeting.demographics.age}</li>
                    <li><strong>Gender:</strong> ${targeting.demographics.gender}</li>
                    <li><strong>Locations:</strong> ${targeting.demographics.locations}</li>
                    <li><strong>Languages:</strong> ${targeting.demographics.languages}</li>
                </ul>

                <h4>Interests</h4>
                <div class="interests-container">
                    <div>
                        <h5>Primary Interests</h5>
                        <ul>
                            ${targeting.interests.primary.map(interest => `<li>${interest}</li>`).join('')}
                        </ul>
                    </div>
                    <div>
                        <h5>Secondary Interests</h5>
                        <ul>
                            ${targeting.interests.secondary.map(interest => `<li>${interest}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                <h4>Behaviors</h4>
                <ul>
                    ${targeting.behaviors.map(behavior => `<li>${behavior}</li>`).join('')}
                </ul>

                <h4>Custom Audiences</h4>
                <p>${targeting.customAudiences}</p>

                <h4>Lookalike Audiences</h4>
                <p>${targeting.lookalikeAudiences}</p>

                <h4>Exclusions</h4>
                <p>${targeting.exclusions}</p>

                <h4>Estimated Audience Size</h4>
                <p>${targeting.audienceSize}</p>
            </div>
        `;
    }

    downloadReport() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const content = document.querySelector('.results-content');
        let yOffset = 20;

        doc.setFontSize(20);
        doc.text('Facebook Ads Strategy Report', 20, yOffset);
        
        doc.setFontSize(12);
        content.querySelectorAll('section').forEach(section => {
            yOffset += 15;
            
            const title = section.querySelector('h3').textContent;
            const text = section.querySelector('div').textContent;
            
            doc.setFont(undefined, 'bold');
            doc.text(title, 20, yOffset);
            
            doc.setFont(undefined, 'normal');
            const splitText = doc.splitTextToSize(text, 170);
            
            yOffset += 10;
            doc.text(splitText, 20, yOffset);
            yOffset += splitText.length * 7;

            if (yOffset > 270) {
                doc.addPage();
                yOffset = 20;
            }
        });

        doc.save('facebook-ads-strategy.pdf');
    }

    handleSaveApiKey() {
        const apiKey = this.apiKeyInput.value.trim();
        if (!apiKey) {
            alert('Please enter a valid API key');
            return;
        }

        localStorage.setItem('openRouterApiKey', apiKey);
        this.apiKeySection.classList.add('hidden');
        this.inputSection.classList.remove('hidden');
        this.configurationError.classList.add('hidden');
    }

    showLoading() {
        this.loadingIndicator.classList.remove('hidden');
        this.results.classList.add('hidden');
    }

    hideLoading() {
        this.loadingIndicator.classList.add('hidden');
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new FacebookAdsGenerator();
}); 