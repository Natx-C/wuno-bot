import ChatLib from "./Chat.js";
import GameLib from "./Game.js";
import CardModel from "../models/card.js";

import cards from "../config/cards.js";

const COLOURS = ["red", "green", "blue", "yellow"];
const SPECIAL = ["draw2", "reverse", "skip"];

const regexValidNormal = new RegExp(`^(${COLOURS.join("|")})[0-9]$`);
const regexValidWild = new RegExp(`^(wild)(${COLOURS.join("|")}|draw4)$`);
const regexValidSpecial = new RegExp(
  `^(${COLOURS.join("|")})(${SPECIAL.join("|")})$`
);

const reducedByNumbers = [...new Array(13)].map((_, idx) => idx);
const filteredWildColor = cards.filter(
  (card) => !new RegExp(`^(wild)(${COLOURS.join("|")})$`).test(card)
);

export default class Card {
  constructor(cardData, chat, game) {
    if (!(chat instanceof ChatLib)) throw new Error("Invalid Chat argument!");
    else if (!(game instanceof GameLib))
      throw new Error("Invalid Game argument!");
    else if (!game.state.WAITING && !(cardData instanceof CardModel))
      throw new Error("Invalid Card data!");

    this.card = cardData;
    this.chat = chat;
    this.game = game;
  }

  static pickRandomCard() {
    const reducedNumber =
      reducedByNumbers[Math.floor(Math.random() * reducedByNumbers.length)];

    return filteredWildColor[
      Math.floor(Math.random() * (cards.length - reducedNumber))
    ];
  }

  static isValidCard(card) {
    return cards.includes(card.trim().replace(" ", "").toLocaleLowerCase());
  }

  isIncluded(card) {
    return this.card.cards.includes(card);
  }

  async removeCardFromPlayer(card) {
    const indexToRemove = this.card.cards.indexOf(card);
    this.card.cards.splice(indexToRemove, 1);

    await this.card.save();
  }

  async addNewCard(card) {
    this.card.cards.push(card);
    await this.card.save();
  }

  getCardState(card) {
    const normalizeCard = card.trim().toLowerCase();

    if (regexValidNormal.test(normalizeCard)) {
      const color = normalizeCard.match(regexValidNormal)[1];
      const number = Number(normalizeCard.slice(color.length));

      return { state: "VALID_NORMAL", color, number };
    } else if (regexValidWild.test(normalizeCard)) {
      const type = normalizeCard.match(regexValidWild)[2];

      return {
        state: "VALID_WILD",
        type,
      };
    } else if (regexValidSpecial.test(normalizeCard)) {
      const type = normalizeCard.match(regexValidSpecial)[2];

      return {
        state: "VALID_SPECIAL",
        type,
      };
    } else {
      return {
        state: "INVALID",
      };
    }
  }

  compareTwoCard(firstCard, secCard) {
    const firstState = this.getCardState(firstCard);
    const secState = this.getCardState(secCard);

    if (firstState?.color === secState?.color) return "STACK";
    if (firstState?.number === secState?.number) return "STACK";

    switch (secState.state) {
      case "":
    }

    return "UNMATCH";
  }

  async drawToCurrentPlayer() {
    const nextPlayer = this.game.getNextPosition();
    const newCard = Card.pickRandomCard();

    await this.addNewCard(newCard);
    await this.game.updatePosition(nextPlayer._id);
    const otherPlayer = `${nextPlayer.phoneNumber.replace("+", "")}@c.us`;

    this.card = await CardModel.findOne({
      game_id: this.game.game._id,
      user_id: nextPlayer._id,
    });

    await Promise.all([
      this.game.sendToOtherPlayersWithoutCurrentPlayer(
        `${this.chat.username} telah mengambil kartu, selanjutnya adalah giliran ${nextPlayer.userName} untuk bermain`
      ),
      this.chat.sendToCurrentPerson(
        `Berhasil mengambil kartu baru, *${newCard}*. selanjutnya adalah giliran ${nextPlayer.userName} untuk bermain`
      ),
      this.chat.sendToOtherPlayer(
        otherPlayer,
        `${this.chat.username} telah mengambil kartu baru, Sekarang giliran kamu untuk bermain`
      ),
    ]);

    await this.chat.sendToOtherPlayer(
      otherPlayer,
      `Kartu saat ini: ${this.game.currentCard}`
    );
    await this.chat.sendToOtherPlayer(
      otherPlayer,
      `Kartu kamu: ${this.card.cards.join(", ")}.`
    );
  }

  async solve(givenCard) {
    const nextPlayer = this.game.getNextPosition();
    const status = this.compareTwoCard(this.game.currentCard, givenCard);

    switch (status) {
      case "STACK": {
        await Promise.all([
          this.game.updateCardAndPosition(givenCard, nextPlayer),
          this.removeCardFromPlayer(givenCard),
        ]);

        this.card = await CardModel.findOne({
          game_id: this.game.game._id,
          user_id: nextPlayer._id,
        });

        const otherPlayer = `${nextPlayer.phoneNumber.replace("+", "")}@c.us`;

        await Promise.all([
          this.game.sendToOtherPlayersWithoutCurrentPlayer(
            `${this.chat.username} telah mengeluarkan kartu *${givenCard}*, selanjutnya adalah giliran ${nextPlayer.userName} untuk bermain`
          ),
          this.chat.sendToCurrentPerson(
            `Berhasil mengeluarkan kartu *${givenCard}*, selanjutnya adalah giliran ${nextPlayer.userName} untuk bermain`
          ),
          this.chat.sendToOtherPlayer(
            otherPlayer,
            `${this.chat.username} telah mengeluarkan kartu *${givenCard}*, Sekarang giliran kamu untuk bermain`
          ),
        ]);

        await this.chat.sendToOtherPlayer(
          otherPlayer,
          `Kartu saat ini: ${this.game.currentCard}`
        );
        await this.chat.sendToOtherPlayer(
          otherPlayer,
          `Kartu kamu: ${this.card.cards.join(", ")}.`
        );

        break;
      }
      case "UNMATCH": {
        await this.chat.sendToCurrentPerson(
          `Kartu *${givenCard}*, tidak valid jika disandingkan dengan kartu *${this.game.currentCard}*! Jika tidak memiliki kartu lagi, ambil dengan '${process.env.PREFIX}d' untuk mengambil kartu baru.`
        );
      }
    }
  }

  get cards() {
    return this.card.cards;
  }
}
