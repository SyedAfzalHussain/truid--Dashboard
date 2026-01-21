module.exports = {
  apps: [
    {
      name: 'dasboard-dobc-app',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/app',
      instances: 1,
      exec_mode: 'fork',
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
