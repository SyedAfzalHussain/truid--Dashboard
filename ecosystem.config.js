module.exports = {
  apps: [
    {
      name: 'nextjs-app',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/home/jim/Desktop/project_frontend',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4444
      }
    }
  ]
};
