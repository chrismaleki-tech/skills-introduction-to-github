"""
Rearc Data Quest Pipeline Stack

This stack creates all the infrastructure needed for the data pipeline:
- S3 buckets for data storage
- Lambda functions for data processing and analytics
- SQS queue for event-driven processing
- CloudWatch Events for scheduling
- IAM roles and policies
- S3 event notifications
"""

import aws_cdk as cdk
from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as lambda_,
    aws_sqs as sqs,
    aws_events as events,
    aws_events_targets as targets,
    aws_iam as iam,
    aws_s3_notifications as s3n,
    Duration,
    RemovalPolicy
)
from constructs import Construct

class RearcDataPipelineStack(Stack):
    """
    Main stack for the Rearc Data Quest pipeline infrastructure.
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # =====================================
        # S3 Buckets
        # =====================================
        
        # BLS data bucket
        self.bls_bucket = s3.Bucket(
            self, "BLSDataBucket",
            bucket_name="rearc-quest-bls-data",
            versioned=True,
            removal_policy=RemovalPolicy.DESTROY,  # For demo purposes
            auto_delete_objects=True,  # For demo purposes
            public_read_access=False,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL
        )

        # Population data bucket
        self.population_bucket = s3.Bucket(
            self, "PopulationDataBucket",
            bucket_name="rearc-quest-population-data",
            versioned=True,
            removal_policy=RemovalPolicy.DESTROY,  # For demo purposes
            auto_delete_objects=True,  # For demo purposes
            public_read_access=False,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL
        )

        # =====================================
        # SQS Queue
        # =====================================
        
        # Dead letter queue
        self.dlq = sqs.Queue(
            self, "AnalyticsDLQ",
            queue_name="rearc-quest-analytics-dlq",
            message_retention_period=Duration.days(14)
        )

        # Main analytics queue
        self.analytics_queue = sqs.Queue(
            self, "AnalyticsQueue",
            queue_name="rearc-quest-analytics-queue",
            visibility_timeout=Duration.minutes(6),  # 6x lambda timeout
            dead_letter_queue=sqs.DeadLetterQueue(
                max_receive_count=3,
                queue=self.dlq
            )
        )

        # =====================================
        # IAM Roles
        # =====================================
        
        # Data processor Lambda role
        self.data_processor_role = iam.Role(
            self, "DataProcessorRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole")
            ]
        )

        # Analytics processor Lambda role
        self.analytics_processor_role = iam.Role(
            self, "AnalyticsProcessorRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole")
            ]
        )

        # Grant permissions to data processor
        self.bls_bucket.grant_read_write(self.data_processor_role)
        self.population_bucket.grant_read_write(self.data_processor_role)

        # Grant permissions to analytics processor
        self.bls_bucket.grant_read(self.analytics_processor_role)
        self.population_bucket.grant_read(self.analytics_processor_role)
        self.analytics_queue.grant_consume_messages(self.analytics_processor_role)

        # =====================================
        # Lambda Functions
        # =====================================
        
        # Data processor Lambda (Parts 1 & 2 combined)
        self.data_processor_lambda = lambda_.Function(
            self, "DataProcessorFunction",
            function_name="rearc-quest-data-processor",
            runtime=lambda_.Runtime.PYTHON_3_9,
            handler="data_processor.lambda_handler",
            code=lambda_.Code.from_asset("../lambda_functions"),
            timeout=Duration.minutes(15),
            memory_size=512,
            role=self.data_processor_role,
            environment={
                "BLS_BUCKET_NAME": self.bls_bucket.bucket_name,
                "POPULATION_BUCKET_NAME": self.population_bucket.bucket_name,
                "ANALYTICS_QUEUE_URL": self.analytics_queue.queue_url
            }
        )

        # Analytics processor Lambda (Part 3)
        self.analytics_processor_lambda = lambda_.Function(
            self, "AnalyticsProcessorFunction",
            function_name="rearc-quest-analytics-processor",
            runtime=lambda_.Runtime.PYTHON_3_9,
            handler="analytics_processor.lambda_handler",
            code=lambda_.Code.from_asset("../lambda_functions"),
            timeout=Duration.minutes(5),
            memory_size=1024,
            role=self.analytics_processor_role,
            environment={
                "BLS_BUCKET_NAME": self.bls_bucket.bucket_name,
                "POPULATION_BUCKET_NAME": self.population_bucket.bucket_name
            }
        )

        # =====================================
        # EventBridge (CloudWatch Events)
        # =====================================
        
        # Daily schedule for data processor
        self.daily_schedule = events.Rule(
            self, "DailyDataProcessingSchedule",
            rule_name="rearc-quest-daily-schedule",
            description="Daily trigger for BLS and Population data processing",
            schedule=events.Schedule.cron(
                minute="0",
                hour="6",  # 6 AM UTC daily
                day="*",
                month="*",
                year="*"
            )
        )

        # Add Lambda target to the schedule
        self.daily_schedule.add_target(
            targets.LambdaFunction(self.data_processor_lambda)
        )

        # =====================================
        # S3 Event Notifications
        # =====================================
        
        # SQS message when JSON files are created in population bucket
        self.population_bucket.add_event_notification(
            s3.EventType.OBJECT_CREATED,
            s3n.SqsDestination(self.analytics_queue),
            s3.NotificationKeyFilter(suffix=".json")
        )

        # =====================================
        # SQS -> Lambda Integration
        # =====================================
        
        # Configure SQS as event source for analytics Lambda
        self.analytics_processor_lambda.add_event_source(
            lambda_.SqsEventSource(
                self.analytics_queue,
                batch_size=1,  # Process one message at a time
                max_batching_window=Duration.seconds(5)
            )
        )

        # =====================================
        # CloudWatch Permissions
        # =====================================
        
        # Allow EventBridge to invoke the data processor Lambda
        self.data_processor_lambda.add_permission(
            "AllowEventBridgeInvoke",
            principal=iam.ServicePrincipal("events.amazonaws.com"),
            source_arn=self.daily_schedule.rule_arn
        )

        # =====================================
        # Outputs
        # =====================================
        
        cdk.CfnOutput(
            self, "BLSBucketName",
            value=self.bls_bucket.bucket_name,
            description="BLS data S3 bucket name"
        )

        cdk.CfnOutput(
            self, "PopulationBucketName",
            value=self.population_bucket.bucket_name,
            description="Population data S3 bucket name"
        )

        cdk.CfnOutput(
            self, "AnalyticsQueueUrl",
            value=self.analytics_queue.queue_url,
            description="Analytics SQS queue URL"
        )

        cdk.CfnOutput(
            self, "DataProcessorLambdaArn",
            value=self.data_processor_lambda.function_arn,
            description="Data processor Lambda function ARN"
        )

        cdk.CfnOutput(
            self, "AnalyticsProcessorLambdaArn",
            value=self.analytics_processor_lambda.function_arn,
            description="Analytics processor Lambda function ARN"
        )