const assert = require("assert");
const aws = require("aws-sdk");
const mjml = require("mjml");
const mustache = require("mustache");

exports.createText = (data) => {
  return mustache.render("Hello {{name}}, thanks for stopping by!", data);
};

exports.createHTML = (data) => {
  const content = `
  <mjml>
    <mj-body>
      <mj-section>
        <mj-column>
          <mj-text>
            Hello {{name}}, thanks for stopping by!
          </mj-text>
        </mj-column>
      </mj-section>
    </mj-body>
  </mjml>`;

  const { html: mjmlOutput, errors } = mjml(content, {});
  assert.ok(errors.length === 0, JSON.stringify(errors));

  return mustache.render(mjmlOutput, data);
};

exports.createSesParams = (data) => {
  if (data.version != '1.0.0') { throw('Unsupported version') }
  return {
    Source: "tom@hillinternet.co.uk",
    Destination: { ToAddresses: [data.email] },
    Message: {
      Subject: { Data: "Test email" },
      Body: {
        Html: { Data: this.createHTML(data) },
        Text: { Data: this.createText(data) },
      },
    },
  };
};

exports.handler = async (event) => {
  try {
    const promises = event.Records.map(async (record) => {
      const ses = new aws.SES();
      const input = JSON.parse(record.body);
      return ses.sendEmail(this.createSesParams(input)).promise();
    });
    await Promise.all(promises);
    return { status: "success" };
  } catch (error) {
    console.log("ERROR is: ", error);
    return { status: "error", error };
  }
};
