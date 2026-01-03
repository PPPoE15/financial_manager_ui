build_dev:
	docker build -t pppoe15/fm-ui:dev .
	
push_dev:
	docker login
	docker push pppoe15/fm-ui:dev
