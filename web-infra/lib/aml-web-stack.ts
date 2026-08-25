import * as path from 'path';
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface AmlWebStackProps extends StackProps {
  runtimeArn: string;
}

export class AmlWebStack extends Stack {
  constructor(scope: Construct, id: string, props: AmlWebStackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        compress: true,
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy:
          cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(1),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(1),
        },
      ],
    });
    const frontendOrigin = `https://${distribution.distributionDomainName}`;

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'aml-grounded-agent-users',
      selfSignUpEnabled: false,
      signInAliases: {
        username: true,
        email: true,
      },
      standardAttributes: {
        email: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: true,
        requireUppercase: true,
        tempPasswordValidity: Duration.days(3),
      },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: {
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(1),
    });

    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
          serverSideTokenCheck: true,
        },
      ],
    });
    const authenticatedRole = new iam.Role(this, 'AuthenticatedUserRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      description:
        'Short-lived browser identity allowed to invoke only the AML web API',
      maxSessionDuration: Duration.hours(1),
    });
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoles', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    const proxy = new lambda.Function(this, 'AgentProxy', {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      timeout: Duration.minutes(5),
      memorySize: 512,
      reservedConcurrentExecutions: 2,
      environment: {
        AGENT_RUNTIME_ARN: props.runtimeArn,
        FRONTEND_ORIGIN: frontendOrigin,
      },
      logGroup: new logs.LogGroup(this, 'AgentProxyLogs', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    proxy.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock-agentcore:InvokeAgentRuntime'],
        resources: [props.runtimeArn, `${props.runtimeArn}/*`],
      }),
    );

    const functionUrl = proxy.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: lambda.InvokeMode.BUFFERED,
      cors: {
        allowedOrigins: [frontendOrigin],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: [
          'authorization',
          'content-type',
          'x-amz-content-sha256',
          'x-amz-date',
          'x-amz-security-token',
        ],
        maxAge: Duration.hours(1),
      },
    });
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunctionUrl'],
        resources: [proxy.functionArn],
        conditions: {
          StringEquals: {
            'lambda:FunctionUrlAuthType': 'AWS_IAM',
          },
        },
      }),
    );
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [proxy.functionArn],
        conditions: {
          Bool: {
            'lambda:InvokedViaFunctionUrl': 'true',
          },
        },
      }),
    );

    new s3deploy.BucketDeployment(this, 'DeployWeb', {
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../web/dist')),
        s3deploy.Source.jsonData('runtime-config.json', {
          apiEndpoint: functionUrl.url,
          region: Stack.of(this).region,
          signingService: 'lambda',
          userPoolId: userPool.userPoolId,
          userPoolClientId: userPoolClient.userPoolClientId,
          identityPoolId: identityPool.ref,
        }),
      ],
    });

    new CfnOutput(this, 'WebUrl', {
      value: frontendOrigin,
    });
    new CfnOutput(this, 'FunctionUrl', {
      value: functionUrl.url,
    });
    new CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });
    new CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
    });
  }
}
