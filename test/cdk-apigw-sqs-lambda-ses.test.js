const cdk = require("aws-cdk-lib");
const { Template, Match } = require("aws-cdk-lib/assertions");
const CdkApigwSqsLambdaSes = require("../lib/cdk-apigw-sqs-lambda-ses-stack");

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
});
