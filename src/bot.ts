import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from "@adiwajshing/baileys";
import { Boom } from "@hapi/boom";
import PQueue from "p-queue";
import dotenv from "dotenv";
import path from "path";
import P from "pino";

import { messageHandler } from "./handler/message";
import { connectDatabase } from "./handler/database";

dotenv.config();

const logger = P({
  transport: {
    targets: [
      {
        target: "pino-pretty",
        level: "debug",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "SYS:standard",
        },
      },
      {
        target: "pino/file",
        level: "debug",
        options: {
          destination: path.join(__dirname, "..", "bot.log"),
        },
      },
    ],
  },
});

export default class Bot {
  private queue = new PQueue({
    concurrency: 4,
    autoStart: false,
  });

  constructor() {
    this.queue.start();
  }

  private isMessageValid(message: string | null | undefined) {
    if (message) return message.startsWith(process.env.PREFIX || "U#");

    return false;
  }

  private async connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(
      "auth_info_baileys"
    );

    const sock = makeWASocket({
      logger,
      auth: state,
      printQRInTerminal: true,
    });

    const onMessageQueue = await messageHandler(sock, logger);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      switch (connection) {
        case "close": {
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut;

          logger.error(
            `Connection closed due to ${lastDisconnect?.error}, reconnecting ${shouldReconnect}`
          );

          if (shouldReconnect) {
            this.connectToWhatsApp();
          }

          break;
        }

        case "open": {
          logger.info("Opened connection");
          break;
        }

        default:
          break;
      }
    });

    sock.ev.on("messages.upsert", async (m) => {
      const WebMessage = m.messages[0];

      if (
        m.type === "notify" &&
        !WebMessage.key.fromMe &&
        WebMessage.key.remoteJid !== "status@broadcast" &&
        WebMessage?.message?.extendedTextMessage?.contextInfo?.remoteJid !==
          "status@broadcast"
      ) {
        if (this.isMessageValid(WebMessage?.message?.conversation)) {
          logger.info(`[Pesan] Ada pesan dari: ${WebMessage?.pushName}`);
          this.queue.add(() => onMessageQueue(WebMessage));
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);
  }

  async init() {
    if (!process.env.MONGO_URI)
      throw new Error("[DB] Diperlukan sebuah koneksi URI MongDB | MONGO_URI");

    await connectDatabase(process.env.MONGO_URI, logger);
    this.connectToWhatsApp();
  }
}
