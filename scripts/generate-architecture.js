#!/usr/bin/env node

/**
 * Mulisa Architecture Documentation Generator
 * Rebuilds architecture-visual.html from Mermaid source files
 */

const fs = require('fs');
const path = require('path');

const DIAGRAMS_DIR = path.join(__dirname, '../docs/architecture/diagrams');
const OUTPUT_FILE = path.join(__dirname, '../docs/architecture-visual.html');

// Read Mermaid source files
const systemOverview = fs.readFileSync(path.join(DIAGRAMS_DIR, 'system-overview.mmd'), 'utf8');
const portConfig = fs.readFileSync(path.join(DIAGRAMS_DIR, 'port-configuration.mmd'), 'utf8');
const dataFlow = fs.readFileSync(path.join(DIAGRAMS_DIR, 'data-flow-sequence.mmd'), 'utf8');
const performance = fs.readFileSync(path.join(DIAGRAMS_DIR, 'performance-latency.mmd'), 'utf8');
const componentMap = fs.readFileSync(path.join(DIAGRAMS_DIR, 'component-integration.mmd'), 'utf8');

// HTML template
const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mulisa Architecture Diagrams</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 20px;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #1976d2;
            text-align: center;
            margin-bottom: 30px;
        }
        h2 {
            color: #424242;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
        }
        .diagram-container {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            background-color: #fafafa;
        }
        .mermaid {
            text-align: center;
        }
        .update-info {
            background: #e8f5e8;
            border: 1px solid #4caf50;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏗️ Mulisa AI-Enhanced Voice Platform - Architecture Diagrams</h1>
        
        <div class="update-info">
            <strong>📅 Last Updated:</strong> ${new Date().toISOString().split('T')[0]} | 
            <strong>🔄 Generated from:</strong> Mermaid source files
        </div>
        
        <h2>📊 System Architecture Overview</h2>
        <div class="diagram-container">
            <div class="mermaid">
${systemOverview}
            </div>
        </div>

        <h2>🔌 Port Configuration & Service Map</h2>
        <div class="diagram-container">
            <div class="mermaid">
${portConfig}
            </div>
        </div>

        <h2>🔄 Data Flow Sequence</h2>
        <div class="diagram-container">
            <div class="mermaid">
${dataFlow}
            </div>
        </div>

        <h2>🏢 Component Integration Map</h2>
        <div class="diagram-container">
            <div class="mermaid">
${componentMap}
            </div>
        </div>

        <h2>⚡ Performance & Latency Breakdown</h2>
        <div class="diagram-container">
            <div class="mermaid">
${performance}
            </div>
        </div>
    </div>

    <script>
        mermaid.initialize({ 
            startOnLoad: true,
            theme: 'default',
            themeVariables: {
                fontFamily: 'Segoe UI, sans-serif',
                fontSize: '14px'
            }
        });
    </script>
</body>
</html>`;

// Write the generated HTML
fs.writeFileSync(OUTPUT_FILE, htmlTemplate);
console.log('✅ Architecture HTML generated successfully!');
console.log('📁 Output:', OUTPUT_FILE);
console.log('🌐 View at: file://' + OUTPUT_FILE);
