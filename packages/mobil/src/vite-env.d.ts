/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Oyun sunucusunun WebSocket adresi (ör. wss://okey.ornek.com/ws). */
  readonly VITE_SUNUCU_URL?: string;
  /** AdMob ödüllü reklam birimi kimliği. Boşsa Google'ın test birimi kullanılır. */
  readonly VITE_ADMOB_ODULLU?: string;
}

/** vite.config.ts'teki define ile package.json'daki sürüm. */
declare const __UYGULAMA_SURUMU__: string;
