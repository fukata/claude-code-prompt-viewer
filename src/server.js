const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const readline = require('readline');
const { createReadStream } = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const CLAUDE_DIR = process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

app.use(express.static('public'));
app.use(express.json());

function sanitizePathName(pathName) {
  return pathName.replace(/\//g, '-').replace(/^-/, '');
}

async function getFirstLine(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const firstLine = content.split('\n')[0];
    return firstLine || null;
  } catch (error) {
    console.error('Error reading first line:', error.message);
    return null;
  }
}

app.get('/api/projects', async (req, res) => {
  try {
    const projectDirs = await fs.readdir(PROJECTS_DIR);
    const projects = [];
    
    for (const dir of projectDirs) {
      const projectPath = path.join(PROJECTS_DIR, dir);
      const stats = await fs.stat(projectPath);
      
      if (stats.isDirectory()) {
        const realPath = dir.replace(/^-/, '').replace(/-/g, '/');
        projects.push({
          id: dir,
          name: path.basename(realPath),
          path: realPath,
          lastModified: stats.mtime
        });
      }
    }
    
    projects.sort((a, b) => b.lastModified - a.lastModified);
    res.json(projects);
  } catch (error) {
    console.error('Error reading projects:', error);
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

app.get('/api/project/:projectId/sessions', async (req, res) => {
  try {
    const projectPath = path.join(PROJECTS_DIR, req.params.projectId);
    const files = await fs.readdir(projectPath);
    const sessions = [];
    
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        const filePath = path.join(projectPath, file);
        const stats = await fs.stat(filePath);
        const sessionId = file.replace('.jsonl', '');
        
        const firstLine = await getFirstLine(filePath);
        
        let sessionInfo = {
          id: sessionId,
          file: file,
          lastModified: stats.mtime,
          size: stats.size
        };
        
        if (firstLine) {
          try {
            const data = JSON.parse(firstLine);
            sessionInfo.startTime = data.timestamp;
            sessionInfo.cwd = data.cwd;
          } catch (e) {
            console.error(`Error parsing first line for session ${sessionId}:`, e);
            console.error('First line content:', firstLine);
          }
        }
        sessions.push(sessionInfo);
      }
    }
    
    sessions.sort((a, b) => b.lastModified - a.lastModified);
    res.json(sessions);
  } catch (error) {
    console.error('Error reading sessions:', error);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

app.get('/api/project/:projectId/session/:sessionId', async (req, res) => {
  try {
    const filePath = path.join(
      PROJECTS_DIR,
      req.params.projectId,
      `${req.params.sessionId}.jsonl`
    );
    
    const messages = [];
    const fileStream = createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    for await (const line of rl) {
      if (line.trim()) {
        try {
          const data = JSON.parse(line);
          messages.push(data);
        } catch (e) {
          console.error('Error parsing line:', e);
        }
      }
    }
    
    res.json(messages);
  } catch (error) {
    console.error('Error reading session:', error);
    res.status(500).json({ error: 'Failed to load session' });
  }
});


app.listen(PORT, () => {
  console.log(`Claude Code Prompt Viewer is running at http://localhost:${PORT}`);
  console.log(`Reading from: ${CLAUDE_DIR}`);
});