import { requiredJoinGameSession } from "../utils";

import { CardModel as Card } from "../models";

export default requiredJoinGameSession(async ({ chat, game }) => {
  if (game.NotFound) {
    return await chat.replyToCurrentPerson({
      text: "Sebuah kesalahan, game tidak ditemukan!",
    });
  } else if (game.isGameCreator) {
    if (game.players.length === 1) {
      return await chat.replyToCurrentPerson({
        text: "Minimal ada dua pemain yang tergabung!",
      });
    } else if (game.state.PLAYING) {
      return await chat.replyToCurrentPerson({
        text: "Game ini sedang dimainkan!",
      });
    }

    await Promise.all(
      game.players.map(
        async (player) =>
          await new Card({ user_id: player._id, game_id: game.id }).save()
      )
    );

    await game.startGame();

    const cards = await Card.find({ game_id: game.id });

    const thisPlayerCards = cards.find(({ user_id }) =>
      user_id.equals(game.currentPlayer!._id)
    );

    await Promise.all([
      (async () => {
        await chat.replyToCurrentPerson({
          text: `Game berhasil dimulai! Sekarang giliran ${
            game.currentPlayerIsAuthor ? "kamu" : game.currentPlayer!.userName
          } untuk bermain`,
        });

        if (game.currentPlayerIsAuthor) {
          await chat.sendToCurrentPerson({
            text: `Kartu saat ini: ${game.currentCard}`,
          });
          await chat.sendToCurrentPerson({
            text: `Kartu kamu: ${thisPlayerCards!.cards.join(", ")}.`,
          });
        }

        return true;
      })(),
      (async () => {
        if (!game.currentPlayerIsAuthor) {
          const toSender = `${game.currentPlayer!.phoneNumber.replace(
            "+",
            ""
          )}@s.whatsapp.net`;

          await chat.sendToOtherPerson(toSender, {
            text: `${chat.message.userName} telah memulai permainan! Sekarang giliran kamu untuk bermain`,
          });
          await chat.sendToOtherPerson(toSender, {
            text: `Kartu saat ini: ${game.currentCard}`,
          });
          await chat.sendToOtherPerson(toSender, {
            text: `Kartu kamu: ${thisPlayerCards?.cards.join(", ")}.`,
          });
        }
      })(),
      game.sendToOtherPlayersWithoutCurrentPlayer(
        `${chat.message.userName} telah memulai permainan! Sekarang giliran ${
          game.currentPlayer!.userName
        } untuk bermain`
      ),
    ]);

    chat.logger.info(`[DB] Game ${game.gameID} dimulai`);
  } else {
    await chat.replyToCurrentPerson({
      text: "Kamu bukanlah orang yang membuat sesi permainannya!",
    });
  }
});
