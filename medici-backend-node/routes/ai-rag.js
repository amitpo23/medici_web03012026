/**
 * AI RAG Routes - Azure OpenAI + Pinecone
 * Advanced AI capabilities with semantic search
 */

const express = require('express');
const router = express.Router();
const { getInstance: getOpenAI } = require('../services/azure-openai-service');
const { getInstance: getPinecone } = require('../services/pinecone-service');
const { getInstance: getRAG } = require('../services/rag-service');
const logger = require('../config/logger');

/**
 * @route   POST /ai/rag/ask
 * @desc    Ask a question using RAG (Retrieval-Augmented Generation)
 * @access  Public
 */
router.post('/ask', async (req, res) => {
  try {
    const { question, topK = 5, includeContext = false } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }

    const rag = getRAG();
    const result = await rag.ask(question, { topK, includeContext });

    res.json({
      success: true,
      question,
      answer: result.answer,
      sources: result.sources,
      usage: result.usage
    });

  } catch (error) {
    logger.error('RAG ask error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /ai/rag/chat
 * @desc    Chat with GPT-4 (without RAG)
 * @access  Public
 */
router.post('/chat', async (req, res) => {
  try {
    const { messages, temperature = 0.7, maxTokens = 2000 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    const openai = getOpenAI();
    const result = await openai.chat(messages, { temperature, maxTokens });

    res.json({
      success: true,
      message: result.message,
      usage: result.usage
    });

  } catch (error) {
    logger.error('Chat error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /ai/rag/search
 * @desc    Semantic search in vector database
 * @access  Public
 */
router.post('/search', async (req, res) => {
  try {
    const { query, topK = 10, filter = null } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const rag = getRAG();
    const results = await rag.search(query, topK, filter);

    res.json({
      success: true,
      query,
      results,
      count: results.length
    });

  } catch (error) {
    logger.error('Semantic search error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /ai/rag/embed
 * @desc    Generate embeddings for text
 * @access  Public
 */
router.post('/embed', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const openai = getOpenAI();
    const result = await openai.createEmbeddings(text);

    res.json({
      success: true,
      embedding: result.embedding,
      dimensions: result.embedding.length
    });

  } catch (error) {
    logger.error('Embedding error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /ai/rag/index/hotels
 * @desc    Index all hotels data into vector database
 * @access  Admin
 */
router.post('/index/hotels', async (req, res) => {
  try {
    const rag = getRAG();
    const result = await rag.indexHotelsData();

    res.json({
      success: true,
      message: 'Hotels indexed successfully',
      indexed: result.indexed
    });

  } catch (error) {
    logger.error('Hotel indexing error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /ai/rag/index/insights
 * @desc    Index booking insights into vector database
 * @access  Admin
 */
router.post('/index/insights', async (req, res) => {
  try {
    const rag = getRAG();
    const result = await rag.indexBookingInsights();

    res.json({
      success: true,
      message: 'Insights indexed successfully',
      indexed: result.indexed
    });

  } catch (error) {
    logger.error('Insights indexing error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /ai/rag/index/document
 * @desc    Index a single document
 * @access  Admin
 */
router.post('/index/document', async (req, res) => {
  try {
    const { id, text, metadata = {} } = req.body;

    if (!id || !text) {
      return res.status(400).json({
        success: false,
        error: 'ID and text are required'
      });
    }

    const rag = getRAG();
    const result = await rag.indexDocument(id, text, metadata);

    res.json({
      success: true,
      message: 'Document indexed successfully',
      id: result.id
    });

  } catch (error) {
    logger.error('Document indexing error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /ai/rag/stats
 * @desc    Get RAG system statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const rag = getRAG();
    const stats = await rag.getStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('RAG stats error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /ai/rag/analyze
 * @desc    Analyze text (sentiment, intent, keywords)
 * @access  Public
 */
router.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const openai = getOpenAI();
    const analysis = await openai.analyzeText(text);

    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    logger.error('Text analysis error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /ai/rag/summarize
 * @desc    Summarize long text
 * @access  Public
 */
router.post('/summarize', async (req, res) => {
  try {
    const { text, maxLength = 200 } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const openai = getOpenAI();
    const summary = await openai.summarize(text, maxLength);

    res.json({
      success: true,
      summary,
      originalLength: text.length,
      summaryLength: summary.length
    });

  } catch (error) {
    logger.error('Summarization error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /ai/rag/health
 * @desc    Check RAG system health
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const openai = getOpenAI();
    const pinecone = getPinecone();
    const rag = getRAG();

    // Check if services are configured
    const health = {
      openai: {
        configured: !!process.env.AZURE_OPENAI_KEY,
        initialized: openai.initialized
      },
      pinecone: {
        configured: !!process.env.PINECONE_API_KEY,
        initialized: pinecone.initialized
      },
      rag: {
        initialized: rag.initialized
      }
    };

    const allHealthy = health.openai.configured && 
                       health.pinecone.configured &&
                       health.rag.initialized;

    res.json({
      success: true,
      status: allHealthy ? 'healthy' : 'degraded',
      services: health
    });

  } catch (error) {
    logger.error('Health check error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
