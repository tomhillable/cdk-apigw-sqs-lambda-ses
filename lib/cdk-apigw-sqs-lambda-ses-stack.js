const { Stack, Duration, Aws } = require('aws-cdk-lib');
const { SqsToLambda, SqsToLambdaProps } = require("@aws-solutions-constructs/aws-sqs-lambda");
const iam = require('aws-cdk-lib/aws-iam');
const lambda = require('aws-cdk-lib/aws-lambda');

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
  }
}

module.exports = { CdkApigwSqsLambdaSesStack }
