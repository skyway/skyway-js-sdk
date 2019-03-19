const { IncomingWebhook } = require('@slack/client');

module.exports = async function notifySlack(text, { NOTIFICATION_ENDOPOINT }) {
  const webhook = new IncomingWebhook(NOTIFICATION_ENDOPOINT);

  console.log(text);
  return webhook.send({
    text,
    username: 'JS-SDK release',
  });
};
