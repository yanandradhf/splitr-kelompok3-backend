const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const routes = require('./src/routes');
const { errorHandler } = require('./src/middlewares');

const app = express();

// Security middleware
app.use(helmet(config.security.helmet));
app.use(cors(config.app.cors));
app.use(rateLimit(config.app.rateLimit));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static('public'));

// API routes
app.use('/', routes);

// Error handling
app.use(errorHandler);

module.exports = app;