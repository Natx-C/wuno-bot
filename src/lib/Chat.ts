import type { proto, WASocket, AnyMessageContent } from "@adiwajshing/baileys";
import { Document, Types, HydratedDocument } from "mongoose";
import { Logger } from "pino";

import { IUser } from "../models/user";

interface IMessage {
  userNumber: string;
  userName: string;
  remoteJid: string;
  id: string;
}

export class Chat {
  sock: WASocket;
  logger: Logger;
  message: IMessage;
  private WebMessage: proto.IWebMessageInfo;
  user?: HydratedDocument<IUser>;

  constructor(
    sock: WASocket,
    WebMessage: proto.IWebMessageInfo,
    logger: Logger
  ) {
    this.sock = sock;
    this.logger = logger;
    this.WebMessage = WebMessage;

    this.message = {
      userNumber: `${
        WebMessage.key.remoteJid!.endsWith("@g.us")
          ? WebMessage.key.participant!
          : WebMessage.key.remoteJid!
      }`,
      userName: WebMessage.pushName!,
      remoteJid: WebMessage.key.remoteJid!,
      id: WebMessage.key.id!,
    };
  }

  private async _simulateTyping(
    remoteJid: string,
    sendCb: () => Promise<void>
  ) {
    await this.sock.presenceSubscribe(remoteJid);
    await this.sock.sendPresenceUpdate("composing", remoteJid);

    await sendCb();

    await this.sock.sendPresenceUpdate("paused", remoteJid);
  }

  private async _sendTo(remoteJid: string, message: AnyMessageContent) {
    await this.sock.sendMessage(remoteJid, message);
  }

  async simulateTypingToCurrentPerson(callback: () => Promise<void>) {
    await this._simulateTyping(this.message.remoteJid, callback);
  }

  async sendToCurrentPerson(message: AnyMessageContent) {
    await this._simulateTyping(
      this.message.remoteJid,
      async () => await this._sendTo(this.message.remoteJid, message)
    );
  }

  async replyToCurrentPerson(message: AnyMessageContent) {
    await this._simulateTyping(this.message.remoteJid, async () => {
      await this.sock.sendMessage(this.message.remoteJid, message, {
        quoted: this.WebMessage,
      });
    });
  }

  async sendToOtherPerson(remoteJid: string, message: AnyMessageContent) {
    await this._sendTo(remoteJid, message);
  }

  setUser(user: HydratedDocument<IUser>) {
    this.user = user;
  }

  get isDMChat() {
    return this.message.remoteJid.endsWith("@c.us");
  }
  get isGroupChat() {
    return this.message.remoteJid.endsWith("@g.us");
  }

  get isJoiningGame() {
    return this.user?.gameProperty.isJoiningGame;
  }
  get gameProperty() {
    return this.user?.gameProperty;
  }
}
