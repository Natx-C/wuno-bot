import { atLeastGameID, df, type commonCb } from "../utils";

import { isDocument } from "@typegoose/typegoose";
// import { User } from "../models"

const commonCallback: commonCb = async ({ chat, game }) =>
  await chat.replyToCurrentPerson({
    text: `GAME ID: ${game.gameID}
Game Status: ${game.translatedStatus}
Tanggal Dibuat: ${df(game.created_at!)}

Pemain yang sudah tergabung:
${game
  .players!.map((player) => isDocument(player) && `- ${player.userName}`)
  .join("\n")}${
      !game.state.PLAYING
        ? ""
        : `
Kartu Saat Ini: ${game.currentCard}
Giliran Pemain Saat Ini: ${
            isDocument(game.currentPlayer) ? game.currentPlayer.userName : ""
          }`
    }`,
  });

export default atLeastGameID(commonCallback, commonCallback);
