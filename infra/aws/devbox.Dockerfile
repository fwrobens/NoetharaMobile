# Isolated per-workspace sandbox for the Noethara coding agent.
# Build on EC2: docker build -t noethara/devbox:latest -f infra/aws/devbox.Dockerfile infra/aws
FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv git curl ca-certificates build-essential procps jq ripgrep \
    && rm -rf /var/lib/apt/lists/* && corepack enable
ENV PIP_BREAK_SYSTEM_PACKAGES=1 NPM_CONFIG_UPDATE_NOTIFIER=false CI=1
USER node
WORKDIR /workspace
