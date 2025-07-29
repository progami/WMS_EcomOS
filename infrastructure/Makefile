.PHONY: help init plan apply destroy ansible-deploy deploy clean status

# Default AWS profile and region
export AWS_PROFILE ?= default
export AWS_REGION ?= us-east-1

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

init: ## Initialize Terraform
	@echo "Initializing Terraform..."
	cd terraform && terraform init

plan: init ## Show what Terraform will create/change
	@echo "Running Terraform plan..."
	cd terraform && terraform plan

apply: init ## Create infrastructure with Terraform
	@echo "Creating infrastructure..."
	cd terraform && terraform apply -auto-approve
	@echo "Infrastructure created successfully!"
	@echo "Run 'make ansible-deploy' to deploy the application"

ansible-check: ## Check Ansible connectivity
	@echo "Checking Ansible connectivity..."
	cd ansible && ansible all -m ping

ansible-deploy: ## Deploy application with Ansible
	@echo "Deploying application with Ansible..."
	@if [ ! -f ansible/inventory/production.yml ]; then \
		echo "Error: Ansible inventory not found. Run 'make apply' first."; \
		exit 1; \
	fi
	@echo "Copying GitHub deploy key..."
	@if [ -f ~/.ssh/github_deploy ]; then \
		echo "Using existing GitHub deploy key"; \
	else \
		cp ~/.ssh/wms-deploy-key.pem ~/.ssh/github_deploy; \
		chmod 600 ~/.ssh/github_deploy; \
	fi
	@echo "Getting S3 bucket name from Terraform..."
	S3_BUCKET_NAME=$$(cd terraform && terraform output -raw s3_bucket_name); \
	cd ansible && ansible-playbook playbook.yml -v \
		-e "s3_bucket_name=$$S3_BUCKET_NAME"

deploy: apply ansible-deploy ## Full deployment (infrastructure + application)
	@echo "Full deployment completed!"
	@echo "Application URL: $$(cd terraform && terraform output -raw application_url)"

destroy: ## Destroy all infrastructure
	@echo "WARNING: This will destroy all infrastructure!"
	@read -p "Are you sure? (yes/no): " confirm && \
	if [ "$$confirm" = "yes" ]; then \
		cd terraform && terraform destroy -auto-approve; \
	else \
		echo "Destroy cancelled."; \
	fi

status: ## Check infrastructure and application status
	@echo "=== Infrastructure Status ==="
	@cd terraform && terraform output
	@echo ""
	@echo "=== Application Status ==="
	@if [ -f ansible/inventory/production.yml ]; then \
		cd ansible && ansible all -m command -a "pm2 list" --become-user=wms; \
	else \
		echo "No infrastructure deployed yet"; \
	fi

logs: ## View application logs
	@if [ -f ansible/inventory/production.yml ]; then \
		cd ansible && ansible all -m command -a "pm2 logs wms-app --lines 50" --become-user=wms; \
	else \
		echo "No infrastructure deployed yet"; \
	fi

ssh: ## SSH into the server
	@if [ -f ansible/inventory/production.yml ]; then \
		IP=$$(grep ansible_host ansible/inventory/production.yml | awk '{print $$2}'); \
		ssh -i ~/.ssh/wms-deploy-key.pem ubuntu@$$IP; \
	else \
		echo "No infrastructure deployed yet"; \
	fi

clean: ## Clean up generated files
	@echo "Cleaning up..."
	rm -f ansible/inventory/production.yml
	rm -rf terraform/.terraform
	rm -f terraform/*.tfstate*
	rm -f terraform/.terraform.lock.hcl
	@echo "Cleanup complete"