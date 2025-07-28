#!/bin/bash
# Minimal EC2 bootstrap script for WMS
# This script only sets up the basic requirements for Ansible to connect

set -e

# Log output
exec > >(tee -a /var/log/user-data-minimal.log)
exec 2>&1

echo "Starting minimal WMS bootstrap at $(date)"

# Update system
apt-get update
apt-get upgrade -y

# Install essential packages for Ansible
apt-get install -y \
  python3 \
  python3-pip \
  python3-apt \
  sudo \
  openssh-server \
  curl \
  wget \
  ca-certificates

# Install AWS SSM agent for secure access
snap install amazon-ssm-agent --classic || {
  wget https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_amd64/amazon-ssm-agent.deb
  dpkg -i amazon-ssm-agent.deb
  rm amazon-ssm-agent.deb
}

# Ensure SSM agent is running
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent

# Create ansible user for deployments
useradd -m -s /bin/bash ansible || echo "User ansible already exists"
echo "ansible ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ansible
chmod 0440 /etc/sudoers.d/ansible

# Setup SSH key for ansible user (if provided via user data)
if [ -n "${ansible_public_key}" ]; then
  mkdir -p /home/ansible/.ssh
  echo "${ansible_public_key}" > /home/ansible/.ssh/authorized_keys
  chown -R ansible:ansible /home/ansible/.ssh
  chmod 700 /home/ansible/.ssh
  chmod 600 /home/ansible/.ssh/authorized_keys
fi

# Configure SSH
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Set hostname
if [ -n "${instance_name}" ]; then
  hostnamectl set-hostname "${instance_name}"
  echo "127.0.1.1 ${instance_name}" >> /etc/hosts
fi

# Configure CloudWatch agent (if needed)
if [ -n "${enable_cloudwatch}" ] && [ "${enable_cloudwatch}" = "true" ]; then
  wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
  dpkg -i amazon-cloudwatch-agent.deb
  rm amazon-cloudwatch-agent.deb
fi

# Write instance metadata
cat > /etc/wms-instance-info <<EOF
INSTANCE_ID=$(ec2-metadata --instance-id | cut -d' ' -f2)
REGION=$(ec2-metadata --availability-zone | cut -d' ' -f2 | sed 's/[a-z]$//')
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BOOTSTRAP_VERSION=1.0.0
EOF

# Signal completion
echo "Minimal WMS bootstrap completed at $(date)"
echo "Ready for Ansible deployment"

# Send completion signal to CloudFormation (if stack exists)
if [ -n "${AWS_STACK_NAME}" ]; then
  /opt/aws/bin/cfn-signal -e $? \
    --stack ${AWS_STACK_NAME} \
    --resource ${AWS_RESOURCE_NAME} \
    --region ${AWS_REGION} || true
fi