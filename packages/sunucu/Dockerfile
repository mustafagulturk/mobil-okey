# Okey sunucusu. Depo kökünden derlenir:
#   docker build -f packages/sunucu/Dockerfile -t okey-sunucu .
#   docker run -p 8080:8080 -v okey-veri:/veri okey-sunucu
# TypeScript derlenmez; tsx kaynağı doğrudan çalıştırır.
FROM node:22-alpine

WORKDIR /app

# Önce sadece paket tanımları: kaynak değişince bağımlılık katmanı önbellekten gelir.
COPY package.json package-lock.json ./
COPY packages/kurallar/package.json packages/kurallar/
COPY packages/sunucu/package.json packages/sunucu/
RUN npm ci --workspace @okey/sunucu --omit=dev && npm cache clean --force

COPY packages/kurallar/src packages/kurallar/src
COPY packages/sunucu/src packages/sunucu/src

# Veritabanı kalıcı birimde durur.
RUN mkdir /veri && chown node:node /veri
VOLUME /veri

ENV NODE_ENV=production \
    PORT=8080 \
    VERITABANI=/veri/okey.db \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning

USER node
WORKDIR /app/packages/sunucu
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/saglik" || exit 1

# node doğrudan PID 1 olur, böylece SIGTERM'i alıp düzgünce kapanır.
CMD ["node", "--import", "tsx", "src/index.ts"]
