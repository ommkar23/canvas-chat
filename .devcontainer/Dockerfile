FROM node:24-bookworm

SHELL ["/bin/bash", "-eo", "pipefail", "-c"]

ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=/usr/local/share/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    openssh-client \
    python3 \
    python3-pip \
    python3-venv \
  && rm -rf /var/lib/apt/lists/* \
  && ln -sf /usr/bin/python3 /usr/local/bin/python \
  && ln -sf /usr/bin/pip3 /usr/local/bin/pip \
  && mkdir -p "${PNPM_HOME}" \
  && corepack enable \
  && corepack prepare pnpm@latest --activate

WORKDIR /workspaces/apps/canvas-chat
