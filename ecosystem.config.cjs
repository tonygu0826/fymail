module.exports = {
  apps: [
    {
      name: "fymail",
      script: "./node_modules/.bin/next",
      args: "start",
      cwd: "/home/ubuntu/fymail",
      env: {
        NODE_ENV: "production",
        NEXT_DIST_DIR: ".next-build",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1536M",
      error_file: "/home/ubuntu/fymail/logs/error.log",
      out_file: "/home/ubuntu/fymail/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
