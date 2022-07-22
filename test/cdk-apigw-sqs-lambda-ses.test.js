const cdk = require("aws-cdk-lib");
const { Template, Match } = require("aws-cdk-lib/assertions");
const CdkApigwSqsLambdaSes = require("../lib/cdk-apigw-sqs-lambda-ses-stack");
const { createSesParams } = require("../src/lambda");

describe("In the output stack", () => {
  const app = new cdk.App();
  const stack = new CdkApigwSqsLambdaSes.CdkApigwSqsLambdaSesStack(
    app,
    "MyTestStack"
  );
  const template = Template.fromStack(stack);

  describe("the SQS queue", () => {
    test("is created with visibility timeout", () => {
      template.hasResourceProperties("AWS::SQS::Queue", {
        VisibilityTimeout: 300,
      });
    });
  });

  describe("the IAM policy", () => {
    test("allows access to SQS", () => {
      template.hasResourceProperties("AWS::SQS::QueuePolicy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(["sqs:SendMessage"]),
              Effect: "Allow",
            }),
          ]),
        },
      });
    });
  });

  describe("the API", () => {
    test("API accepts POST request and forwards to AWS service (SQS)", () => {
      template.hasResourceProperties("AWS::ApiGateway::Method", {
        HttpMethod: "POST",
        Integration: { Type: "AWS" },
      });
    });

    test("API has /email path part", () => {
      template.hasResourceProperties("AWS::ApiGateway::Resource", {
        PathPart: "email",
      });
    });

    test("API has input validation", () => {
      template.hasResourceProperties("AWS::ApiGateway::Model", {});
    });

    test("API has API key", () => {
      template.hasResourceProperties("AWS::ApiGateway::ApiKey", {});
    });
  });
});

describe("The lambda function", () => {
  const record = {
    version: "1.0.0",
    name: "Tom Hill",
    email: "example@example.com",
  };

  test("can generate valid SES parameters", () => {
    const params = createSesParams(record);
    expect(params).toMatchObject(
      expect.objectContaining({
        Source: expect.any(String),
        Destination: { ToAddresses: ["example@example.com"] },
        Message: {
          Subject: { Data: expect.any(String) },
          Body: {
            Html: expect.objectContaining({ Data: expect.any(String) }),
            Text: expect.objectContaining({ Data: expect.any(String) }),
          },
        },
      })
    );
  });
  test("rejects records with unknown schema version", () => {
    expect(() => { createSesParams({version: '3.2.1'}); }).toThrow();
  });
});
