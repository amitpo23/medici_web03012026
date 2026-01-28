/**
 * Azure OpenAI Service
 * Provides GPT-4 and Embeddings capabilities
 */

const { AzureOpenAI } = require('openai');
const logger = require('../config/logger');

class AzureOpenAIService {
  constructor() {
    this.endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    this.apiKey = process.env.AZURE_OPENAI_KEY;
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';
    this.embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002';
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize Azure OpenAI client
   */
  async initialize() {
    try {
      if (!this.endpoint || !this.apiKey) {
        throw new Error('Azure OpenAI credentials not configured');
      }

      this.client = new AzureOpenAI({
        apiKey: this.apiKey,
        endpoint: this.endpoint,
        apiVersion: '2024-02-15-preview'
      });

      this.initialized = true;
      logger.info('✅ Azure OpenAI Service initialized', {
        endpoint: this.endpoint,
        deployment: this.deploymentName
      });

    } catch (error) {
      logger.error('Failed to initialize Azure OpenAI', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure client is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generate chat completion with GPT-4
   * @param {Array} messages - Chat messages [{role: 'user', content: '...'}]
   * @param {Object} options - Optional parameters (temperature, max_tokens, etc.)
   */
  async chat(messages, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        temperature = 0.7,
        maxTokens = 2000,
        topP = 0.95,
        frequencyPenalty = 0,
        presencePenalty = 0
      } = options;

      logger.debug('Azure OpenAI chat request', {
        deployment: this.deploymentName,
        messageCount: messages.length,
        temperature
      });

      const response = await this.client.chat.completions.create({
        model: this.deploymentName,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty
      });

      const result = {
        message: response.choices[0].message.content,
        role: response.choices[0].message.role,
        finishReason: response.choices[0].finish_reason,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        },
        model: response.model
      };

      logger.info('Azure OpenAI chat completed', {
        tokens: result.usage.totalTokens,
        finishReason: result.finishReason
      });

      return result;

    } catch (error) {
      logger.error('Azure OpenAI chat error', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate embeddings for text
   * @param {String|Array} input - Text or array of texts to embed
   */
  async createEmbeddings(input) {
    await this.ensureInitialized();

    try {
      const inputs = Array.isArray(input) ? input : [input];

      logger.debug('Creating embeddings', {
        deployment: this.embeddingDeployment,
        count: inputs.length
      });

      const response = await this.client.embeddings.create({
        model: this.embeddingDeployment,
        input: inputs
      });

      const embeddings = response.data.map(item => ({
        index: item.index,
        embedding: item.embedding
      }));

      logger.info('Embeddings created', {
        count: embeddings.length,
        dimensions: embeddings[0].embedding.length
      });

      return Array.isArray(input) ? embeddings : embeddings[0];

    } catch (error) {
      logger.error('Embedding creation error', { error: error.message });
      throw error;
    }
  }

  /**
   * Smart chat with system context
   * Useful for domain-specific conversations
   */
  async smartChat(userMessage, systemContext, conversationHistory = []) {
    const messages = [
      {
        role: 'system',
        content: systemContext
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage
      }
    ];

    return await this.chat(messages);
  }

  /**
   * Analyze text sentiment and intent
   */
  async analyzeText(text) {
    const systemPrompt = `You are an AI assistant that analyzes text and returns structured JSON.
Analyze the following text and return:
{
  "sentiment": "positive|negative|neutral",
  "intent": "question|command|statement|feedback",
  "keywords": ["key1", "key2"],
  "summary": "brief summary",
  "language": "he|en|other"
}`;

    const response = await this.smartChat(text, systemPrompt);
    
    try {
      return JSON.parse(response.message);
    } catch {
      return { raw: response.message };
    }
  }

  /**
   * Generate SQL from natural language (using GPT-4)
   */
  async textToSQL(question, schema) {
    const systemPrompt = `You are an expert SQL developer. Convert natural language questions to SQL queries.
Database Schema:
${JSON.stringify(schema, null, 2)}

Rules:
- Return ONLY the SQL query, no explanations
- Use proper table names from the schema
- Handle Hebrew and English questions
- Use appropriate JOINs, WHERE, GROUP BY, ORDER BY
- Add LIMIT when appropriate`;

    const response = await this.smartChat(question, systemPrompt);
    return response.message.replace(/```sql|```/g, '').trim();
  }

  /**
   * Summarize long text
   */
  async summarize(text, maxLength = 200) {
    const systemPrompt = `Summarize the following text in ${maxLength} words or less. Be concise and capture key points.`;
    
    const response = await this.smartChat(text, systemPrompt);
    return response.message;
  }

  /**
   * Extract structured data from text
   */
  async extractData(text, schema) {
    const systemPrompt = `Extract structured data from the text according to this schema:
${JSON.stringify(schema, null, 2)}

Return ONLY valid JSON matching the schema.`;

    const response = await this.smartChat(text, systemPrompt);
    
    try {
      return JSON.parse(response.message);
    } catch {
      return null;
    }
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new AzureOpenAIService();
    }
    return instance;
  },
  AzureOpenAIService
};
