variable "project_name" {
  type        = string
  description = "리소스 이름 접두사"
  default     = "english-learning"
}

variable "environment" {
  type        = string
  description = "배포 환경명"
  default     = "prod"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "ap-northeast-2"
}

variable "domain_name" {
  type        = string
  description = "운영용 루트 도메인. 예: chunsay.com"
  default     = ""
}

variable "api_subdomain" {
  type        = string
  description = "API 서브도메인 prefix"
  default     = "api"
}

variable "azs" {
  type        = list(string)
  description = "배포에 사용할 가용 영역"
  default     = ["ap-northeast-2a", "ap-northeast-2c"]
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR"
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "퍼블릭 서브넷 CIDR"
  default     = ["10.20.0.0/24", "10.20.1.0/24"]
}

variable "private_app_subnet_cidrs" {
  type        = list(string)
  description = "애플리케이션용 프라이빗 서브넷 CIDR"
  default     = ["10.20.10.0/24", "10.20.11.0/24"]
}

variable "private_db_subnet_cidrs" {
  type        = list(string)
  description = "DB용 프라이빗 서브넷 CIDR"
  default     = ["10.20.20.0/24", "10.20.21.0/24"]
}

variable "web_image" {
  type        = string
  description = "web 컨테이너 이미지 URI"
}

variable "api_image" {
  type        = string
  description = "api 컨테이너 이미지 URI"
}

variable "worker_image" {
  type        = string
  description = "worker 컨테이너 이미지 URI"
}

variable "web_desired_count" {
  type        = number
  default     = 1
  description = "web 서비스 desired count"
}

variable "api_desired_count" {
  type        = number
  default     = 1
  description = "api 서비스 desired count"
}

variable "worker_desired_count" {
  type        = number
  default     = 1
  description = "worker 서비스 desired count"
}

variable "web_cpu" {
  type    = number
  default = 512
}

variable "web_memory" {
  type    = number
  default = 1024
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "worker_cpu" {
  type    = number
  default = 512
}

variable "worker_memory" {
  type    = number
  default = 1024
}

variable "db_name" {
  type    = string
  default = "english_learning"
}

variable "db_username" {
  type    = string
  default = "elp_admin"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS master password"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "API JWT secret"
}

variable "jwt_expires_in" {
  type    = string
  default = "7d"
}

variable "openai_api_key" {
  type        = string
  sensitive   = true
  description = "OpenAI API key"
}

variable "openai_llm_model" {
  type    = string
  default = "gpt-4.1-mini"
}

variable "openai_stt_model" {
  type    = string
  default = "gpt-4o-mini-transcribe"
}

variable "openai_stt_diarize_model" {
  type    = string
  default = "gpt-4o-transcribe-diarize"
}

variable "openai_tts_model" {
  type    = string
  default = "gpt-4o-mini-tts"
}

variable "openai_tts_voice" {
  type    = string
  default = "alloy"
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "S3 CORS 허용 origin"
  default     = ["http://localhost:3000"]
}
