$(document).ready(function() {
	reloadCategories();
	
	var categories = getCategories();
	var transactions = getTransactions();
	var pieData = new Array();
	var months = new Array();
	
	$.each(transactions, function(index, transaction) {
		if (typeof pieData[transaction.category] == 'undefined') {
			pieData[transaction.category] = { label: categories[transaction.category].name, data: transaction.amount };
		} else {
			pieData[transaction.category].data += transaction.amount;
		}
		
		var date = transaction.date.substr(3).split('.');
		date = parseInt(date[1] + date[0]);
		
		if ($.inArray(date, months) == -1) months.push(date);
	});
	
	months.sort(function(a, b) {
		return b - a;
	});
	
	$.each(months, function(index, month) {
		var text = month.toString().substr(4, 2) + '/' + month.toString().substr(0, 4);
		$('#select-month').append($('<option />').text(text));
	});
	
	if (pieData.length <= 0) {
		$('#main-pie').text('Ei tapahtumia');
	} else {
		displayPie('#main-pie', pieData);
	}
	
	$('#select-month').on('change', function() {
		var month = $('#select-month').val();
		var pieData = new Array();
		
		$.each(transactions, function(index, transaction) {
			if (transaction.date.substr(3).replace('.', '/') != month) return true;
			
			if (typeof pieData[transaction.category] == 'undefined') {
				pieData[transaction.category] = { label: categories[transaction.category].name, data: transaction.amount };
			} else {
				pieData[transaction.category].data += transaction.amount;
			}
		});
		
		if (pieData.length <= 0) {
			$('#month-pie').text('Ei tapahtumia');
		} else {
			displayPie('#month-pie', pieData);
		}
		
		$('#month-title').text(month);
		$('<a />').attr({ href: '#month-tab', 'data-toggle': 'tab' }).tab('show');
	});
	
	$('#add-category-input').keypress(function(e) {
		if (e.which != 13) return true;
		
		addCategory($(this).val());
		$('#add-category-modal').modal('hide');
		$(this).val('');
		
		e.preventDefault();
		return false;
	});
	
	$('#add-transactions-file').on('change', handleUpload);
});

function displayPie(element, data) {
	$.plot(element, data, {
		series: {
			pie: {
				show: true,
				radius: 1,
				label: {
					show: true,
					radius: 3/4,
					formatter: labelFormatter,
					background: {
						opacity: 0.5,
					},
				},
			},
		},
		
		legend: {
			show: false,
		},
	});
}

function labelFormatter(label, series) {
	return '<div style="font-size: 8pt; text-align: center; padding: 2px; color: white;">' + label + '<br />' + (series.data[0][1]).toFixed(2) + '€</div>';
}

function handleUpload(event) {
	var files = event.target.files;
	if (files.length <= 0) return;
	
	var file = files[0];
	var reader = new FileReader();
	reader.onload = (function(f) {
		return function(e) {
			var categories = getCategories();
			var unknown = parseTransactions(e.target.result);
			
			$.each(unknown, function(index, transaction) {
				$('#add-transactions-file').after($('<h4 />').addClass('add-transactions-description hidden').text(transaction.description).data('transaction', transaction));
			});
			
			$('.add-transactions-description:first').removeClass('hidden');
			
			$.each(categories, function(index, category) {
				$('#add-transactions-body').append($('<button />').attr('type', 'button').addClass('btn btn-primary add-transactions-category').data('id', index).text(category.name).click(function() {
					var transactions = getTransactions();
					var categories = getCategories();
					
					var transaction = $('.add-transactions-description:first').data('transaction');
					transaction.category = $(this).data('id');
					categories[transaction.category].contains.push(transaction.description);
					
					transactions.push(transaction);
					localStorage.setItem('transactions', JSON.stringify(transactions));
					localStorage.setItem('categories', JSON.stringify(categories));
					
					$('.add-transactions-description:first').remove();
					
					if ($('.add-transactions-description').length <= 0) {
						$('#add-transactions-modal').modal('hide');
						return false;
					}
					
					$('.add-transactions-description:first').removeClass('hidden');
				}));
			});
		};
	})(file);
	
	reader.readAsText(file);
}

function parseTransactions(data) {
	var transactions = getTransactions();
	var categories = getCategories();
	var unknown = new Array();
	data = data.split("\n");
	
	$.each(data, function(key, value) {
		value = value.trim();
		if (value.length <= 0) return true;
		
		original = value;
		value = value.split("\t");
		
		if (value.length <= 5) return true;
		
		var date = value[2];
		var amount = parseFloat(value[3].replace(',', '.'));
		var description = value[4];
		var category = null;
		var exists = false;
		
		if (isNaN(amount) || amount >= 0) return true;
		
		amount = Math.abs(amount);
		
		$.each(categories, function(index, object) {
			if ($.inArray(description, object.contains) != -1) category = index;
		});
		
		if (category == null) {
			unknown.push({ date: date, amount: amount, description: description, original: original });
			return true;
		}
		
		$.each(transactions, function(index, transaction) {
			if (transaction.original == original) {
				exists = true;
				return false;
			}
		});
		
		if (exists) {
			return true;
		}
		
		transactions.push({ category: category, date: date, amount: amount, description: description, original: original });
	});
	
	localStorage.setItem('transactions', JSON.stringify(transactions));
	return unknown;
}

function getTransactions() {
	var transactions = localStorage.getItem('transactions');
	
	if (transactions == null || transactions.length <= 0) transactions = new Array();
	else transactions = JSON.parse(transactions);
	
	return transactions;

}

function getCategories() {
	var categories = localStorage.getItem('categories');
	
	if (categories == null || categories.length <= 0) categories = new Array();
	else categories = JSON.parse(categories);
	
	return categories;
}

function addCategory(name) {
	var categories = getCategories();
	categories.push({ name: name, contains: new Array() });
	localStorage.setItem('categories', JSON.stringify(categories));
	
	reloadCategories();
}

function renameCategory(categoryID, name) {
	var categories = getCategories();
	categories[categoryID].name = name;
	localStorage.setItem('categories', JSON.stringify(categories));
	
	reloadCategories();
}

function removeCategory(categoryID) {
	var categories = getCategories();
	var transactions = getTransactions();
	categories.splice(categoryID, 1);
	
	transactions = $.grep(transactions, function(transaction, key) {
		if (transaction.category == categoryID) {
			return false;
		}
		
		return true;
	});
	
	localStorage.setItem('transactions', JSON.stringify(transactions));
	localStorage.setItem('categories', JSON.stringify(categories));
	
	reloadCategories();
}

function reloadCategories() {
	var categories = getCategories();
	var transactions = getTransactions();
	
	$('#categories li').remove();
	$('.category-tab').remove();
	
	$.each(categories, function(key, data) {
		var name = data.name;
		var safeName = name.toLowerCase().replace(' ', '-').replace(/\W/g, '');
		var element = $('<li />').data('id', key);
		$(element).append($('<a />').attr({ href: '#tab-' + safeName, 'data-toggle': 'tab' }).text(name).dblclick(function() {
			var name = $(this).text();
			$(this).html('');
			$(this).append($('<input />').addClass('form-control').attr({ type: 'text', value: name, autofocus: 'true' }).css({ width: '90%' }).keypress(function(e) {
				if (e.which != 13) return true;
				
				renameCategory($(this).parent().parent().data('id'), $(this).val());
				
				e.preventDefault();
				return false;
			}));
		}));
		
		$(element).append($('<a />').addClass('remove-category').attr('href', '#').html('&times;').click(function(e) {
			var remove = confirm('Haluatko tosiaan poistaa tämän kategorian?');
			var categoryID = $(this).parent().data('id');
			e.preventDefault();
			
			if (!remove) return;
			
			removeCategory(categoryID);
		}));
		
		$('#categories').append(element);
		
		var content = $('<div />').addClass('tab-pane category-tab').attr('id', 'tab-' + safeName);
		var table = $('<table />').addClass('table');
		var thead = $('<thead />');
		var tbody = $('<tbody />');
		var tr = $('<tr />');
		$(tr).append($('<th />').text('Päivämäärä'));
		$(tr).append($('<th />').text('Tapahtuma'));
		$(tr).append($('<th />').text('Summa'));
		
		$.each(transactions, function(index, transaction) {
			if (transaction.category != key) return true;
			
			$(tbody).append($('<tr />').addClass('draggable ui-widget-content').append($('<td />').text(transaction.date)).append($('<td />').text(transaction.description)).append($('<td />').text(transaction.amount.toFixed(2) + '€')).data('id', index).attr('data-id', index));
		});
		
		$(thead).append(tr);
		$(table).append(thead);
		$(table).append(tbody);
		$(content).append(table);
		$('.tab-content').append(content);
		$('.draggable').draggable({ helper: 'clone', revert: 'invalid' });
	});
	
	$('#categories li').droppable({
		tolerance: 'touch',
		drop: function(event, ui) {
			var moveAll = confirm('Haluatko siirtää kaikki vastaavat tapahtumatkin?');
			var categories = getCategories();
			var transactions = getTransactions();
			var categoryID = $(event.target).data('id');
			var transactionID = $(ui.draggable.context).data('id');
			
			if (moveAll) {
				$.each(transactions, function(key, transaction) {
					if (transaction.description == transactions[transactionID].description) {
						transaction.category = categoryID;
					}
				});
				
				$.each(categories, function(key, category) {
					$.each(category.contains, function(index, data) {
						if (data == transactions[transactionID].description) {
							category.contains.splice(index, 1);
							return false;
						}
					});
				});
				
				categories[categoryID].contains.push(transactions[transactionID].description);
			} else {
				transactions[transactionID].category = categoryID;
			}
			
			localStorage.setItem('categories', JSON.stringify(categories));
			localStorage.setItem('transactions', JSON.stringify(transactions));
			
			$(ui.draggable).remove();
			reloadCategories();
		}
	});
	
	tabViews();
}

function tabViews() {
	var tab = location.hash.substr(1);
	if (/^[a-z\-]+$/.test(tab)) $('a[href="#tab-' + tab + '"]').tab('show');
	
	$('a[data-toggle="tab"]').on('shown.bs.tab', function(e) {
		var tab = $(e.target).attr('href').substr(5);
		if (history.pushState) history.pushState(null, null, '#' + tab);
		else location.hash = tab;
	});
}