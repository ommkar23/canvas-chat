FROM alpine:3.23.3

SHELL ["/bin/ash", "-eo", "pipefail", "-c"]

ENV NVM_DIR=/usr/local/share/nvm
ENV PNPM_HOME=/usr/local/share/pnpm
ENV NODE_VERSION=24.14.1
ENV PATH=/usr/local/share/pnpm:/usr/local/share/nvm/versions/node/v24.14.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apk add --no-cache \
    bash \
    ca-certificates \
    curl \
    gcc \
    git \
    g++ \
    libc6-compat \
    linux-headers \
    make \
    openssh-client \
    py3-pip \
    python3 \
    sudo \
    tini \
  && ln -sf /usr/bin/python3 /usr/local/bin/python \
  && ln -sf /usr/bin/pip3 /usr/local/bin/pip

RUN mkdir -p "${NVM_DIR}" "${PNPM_HOME}" \
  && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | PROFILE=/dev/null NVM_DIR="${NVM_DIR}" bash \
  && bash -lc ". \"${NVM_DIR}/nvm.sh\" \
    && nvm install ${NODE_VERSION} \
    && nvm alias default ${NODE_VERSION} \
    && npm install -g corepack \
    && corepack enable \
    && corepack prepare pnpm@latest --activate" \
  && ln -sf "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/node" /usr/local/bin/node \
  && ln -sf "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/npm" /usr/local/bin/npm \
  && ln -sf "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/npx" /usr/local/bin/npx \
  && ln -sf "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/corepack" /usr/local/bin/corepack \
  && ln -sf "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/pnpm" /usr/local/bin/pnpm \
  && ln -sf "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/pnpx" /usr/local/bin/pnpx

WORKDIR /workspaces/apps/canvas-chat
