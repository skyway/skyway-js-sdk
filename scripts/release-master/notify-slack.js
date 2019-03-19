const { IncomingWebhook } = require('@slack/client');
const { NOTIFICATION_ENDOPOINT } = process.env;

module.exports = async function notifySlack(text) {
  const webhook = new IncomingWebhook(NOTIFICATION_ENDOPOINT);

  console.log(text);
  return webhook.send({
    text,
    username: 'JS-SDK release',
  });
};
