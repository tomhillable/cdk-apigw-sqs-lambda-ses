const { Stack, Duration, Aws } = require('aws-cdk-lib');
const { SqsToLambda, SqsToLambdaProps } = require("@aws-solutions-constructs/aws-sqs-lambda");
const apigateway = require('aws-cdk-lib/aws-apigateway');
const iam = require('aws-cdk-lib/aws-iam');
const lambda = require('aws-cdk-lib/aws-lambda');
const sqs = require('aws-cdk-lib/aws-sqs');

class CdkApigwSqsLambdaSesStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // https://docs.aws.amazon.com/solutions/latest/constructs/aws-sqs-lambda.html
    const sqsToLambda = new SqsToLambda(this, 'SqsToLambdaPattern', {
      lambdaFunctionProps: {
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: 'lambda.handler',
        code: lambda.Code.fromAsset(`src`)
      },
      queueProps: {visibilityTimeout: Duration.seconds(300)}
    })

    sqsToLambda.lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [ 'ses:SendEmail' ],
        resources: [ `arn:aws:ses:${Aws.REGION}:${Aws.ACCOUNT_ID}:identity/*` ],
      })
    )
    const queue = sqsToLambda.sqsQueue

    const sendMessagesRole = new iam.Role(this, "ApiRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });
    
    sendMessagesRole.attachInlinePolicy(new iam.Policy(this, "SendMessagesPolicy", {
        statements: [
          new iam.PolicyStatement({
            actions: ["sqs:SendMessage"],
            effect: iam.Effect.ALLOW,
            resources: [queue.queueArn],
          }),
        ],
      })
    );

    const api = new apigateway.RestApi(this, 'API', {
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true
      }
    });

    /*
    Integration with SQS.
    https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-making-api-requests.html
    */
    const sqsBackendIntegration = new apigateway.AwsIntegration({
      service: "sqs",
      path: `${Aws.ACCOUNT_ID}/${queue.queueName}`,
      options: {
        credentialsRole: sendMessagesRole,
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestParameters: {
          "integration.request.header.Content-Type": `'application/x-www-form-urlencoded'`,
        },
        requestTemplates: {
          "application/json": "Action=SendMessage&MessageBody=$util.urlEncode(\"$input.body\")",
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: { "application/json": `{"success": true}` }
          },
          {
            statusCode: "500",
            responseTemplates: { "application/json": `{"success": false}` },
            selectionPattern: "[45]\\d{2}"
          }
        ],
      }
    })

    /*
    {
      "version": "1.0.0",
      "name": "Tom Hill",
      "email": "valid@email.com"
    }
    */
    const inputModel = api.addModel('InputModel', {
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          version: { type: apigateway.JsonSchemaType.STRING, enum: [ "1.0.0" ] },
          name: { type: apigateway.JsonSchemaType.STRING },
          email: { type: apigateway.JsonSchemaType.STRING, pattern: "^\\S+@\\S+\\.\\S+$" }
        },
        required: ["version", "name", "email"],
        additionalProperties: false
      }
    })

    const email = api.root.addResource("email");
    email.addMethod("POST", sqsBackendIntegration, {
      apiKeyRequired: true,
      authorizationType: apigateway.AuthorizationType.NONE,
      requestModels: { 'application/json': inputModel },
      requestValidatorOptions: { validateRequestBody: true },
      methodResponses: [ { statusCode: '200'}, { statusCode: '500'} ]
    })
  
    const plan = api.addUsagePlan('UsagePlan', { apiStages: [{api, stage: api.deploymentStage}] })
    const key = api.addApiKey('SendEmailAPIKey');
    plan.addApiKey(key)
  }
}

module.exports = { CdkApigwSqsLambdaSesStack }
