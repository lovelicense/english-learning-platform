output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "공용 ALB DNS"
}

output "web_url" {
  value       = local.web_origin
  description = "웹 접근 URL"
}

output "api_url" {
  value       = local.api_origin
  description = "API 접근 URL"
}

output "api_domain_name" {
  value       = local.has_custom_domain ? local.api_domain : null
  description = "API 커스텀 도메인"
}

output "audio_bucket_name" {
  value       = aws_s3_bucket.audio.bucket
  description = "음성 파일 저장 S3 버킷"
}

output "db_endpoint" {
  value       = aws_db_instance.postgres.address
  description = "RDS endpoint"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS cluster name"
}

output "web_ecr_repository_url" {
  value       = aws_ecr_repository.web.repository_url
  description = "web 이미지 푸시용 ECR"
}

output "api_ecr_repository_url" {
  value       = aws_ecr_repository.api.repository_url
  description = "api 이미지 푸시용 ECR"
}

output "worker_ecr_repository_url" {
  value       = aws_ecr_repository.worker.repository_url
  description = "worker 이미지 푸시용 ECR"
}
